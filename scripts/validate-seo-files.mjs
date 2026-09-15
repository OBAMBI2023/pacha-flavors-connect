// Post-build gate for the SEO files scripts/generate-seo-files.mjs writes.
// Exits non-zero (failing `npm run build`) if any of them is missing, isn't
// well-formed XML, references the wrong domain, references a private route,
// or points at a sitemap file that doesn't actually exist in the same
// output directory -- the class of bug that shipped a placeholder sitemap
// (and a robots.txt pointing at the wrong domain) to production because
// nothing checked what actually landed in the deployed output directory.
//
// sitemap-restaurants.xml is the one deliberate exception to "must exist on
// disk": it's served at request time by server/sitemap-restaurants.ts, not
// written by generate-seo-files.mjs (see that script's own header comment
// for why). This validator both excuses that one file from the on-disk
// check and actively fails the build if a *static* file ever appears at
// that exact path -- e.g. from a future edit to generate-seo-files.mjs --
// since a static file there would silently shadow the dynamic route on
// Vercel and reintroduce the "frozen until next deploy" problem this
// architecture exists to remove. See DYNAMIC_SITEMAPS below.
//
// Resolves the directory to check the exact same way generate-seo-files.mjs
// resolves where to write (see scripts/lib/nitro-output.mjs) -- so this
// always validates the files Vercel will actually deploy, not a directory
// that happens to exist locally.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { resolveNitroPublicDir } from "./lib/nitro-output.mjs";
import { assertWellFormedXml, extractLocValues } from "./lib/xml-wellformed.mjs";

const ROOT_DIR = resolve(fileURLToPath(import.meta.url), "../..");

const CANONICAL_ORIGIN = "https://food.saovia.net";
const FORBIDDEN_DOMAIN = "saoviafood.com";

// Same private-route set as generate-seo-files.mjs's DISALLOWED_PATHS and
// generate-sw.mjs's navigateFallbackDenylist -- duplicated here for the same
// reason those are duplicated (this plain Node script can't import the
// app's TS source), kept in sync by hand.
const DISALLOWED_PATH_PREFIXES = [
  "/admin",
  "/super-admin",
  "/auth",
  "/commande",
  "/commandes",
  "/livreur",
  "/deliver",
  "/delivery",
];

// Routes that exist only as a permanent redirect to another indexable page
// (never a page of their own) -- a sitemap <loc> must always be the final,
// 200-rendering destination, never a redirecting URL (Search Console audit,
// 2026-09-14: /food's 301 to "/" made Google report "ne reconnaît pas cette
// URL" instead of indexing it). Exact-match, not a prefix: legitimate child
// routes like /food/conseils and /food-signup are real pages and must stay
// out of this list.
const REDIRECTING_PATHS = ["/food"];

// Sub-sitemaps that are served dynamically (server/sitemap-restaurants.ts),
// never written to the static build output. Relative to CANONICAL_ORIGIN,
// matching how <loc> values are checked below.
const DYNAMIC_SITEMAPS = ["sitemap-restaurants.xml"];

const errors = [];
const passed = [];

function fail(file, message) {
  errors.push(`${file}: ${message}`);
}

function ok(file, message) {
  passed.push(`${file}: ${message}`);
}

async function fileExists(path) {
  return readFile(path, "utf8").then(
    () => true,
    () => false,
  );
}

/** Validates a sitemap/sitemap-index XML file. Returns its <loc> values on success, [] on failure (errors already recorded). */
async function validateXmlFile(publicDir, relPath, { checkLocsExist }) {
  const path = resolve(publicDir, relPath);
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch {
    fail(relPath, "file is missing from the build output");
    return [];
  }

  try {
    assertWellFormedXml(content);
  } catch (e) {
    fail(relPath, `invalid XML -- ${e.message}`);
    return [];
  }
  ok(relPath, "well-formed XML");

  if (content.includes(FORBIDDEN_DOMAIN)) {
    fail(relPath, `contains a reference to the old domain "${FORBIDDEN_DOMAIN}"`);
  }

  const locs = extractLocValues(content);
  if (locs.length === 0) {
    fail(relPath, "contains no <loc> entries");
  }

  for (const loc of locs) {
    let url;
    try {
      url = new URL(loc);
    } catch {
      fail(relPath, `<loc> is not an absolute URL: "${loc}"`);
      continue;
    }
    if (url.protocol !== "https:") {
      fail(relPath, `<loc> is not https: "${loc}"`);
    }
    const badPath = DISALLOWED_PATH_PREFIXES.find(
      (p) => url.pathname === p || url.pathname.startsWith(`${p}/`),
    );
    if (badPath) {
      fail(relPath, `<loc> references a private route "${badPath}": "${loc}"`);
    }
    if (REDIRECTING_PATHS.includes(url.pathname)) {
      fail(relPath, `<loc> references "${url.pathname}", which only redirects -- point the sitemap at its actual destination instead: "${loc}"`);
    }
    // Only URLs on our own canonical origin are checked for on-disk
    // existence -- a tenant custom-domain <loc> (a different origin,
    // deployed by a different project) is intentionally out of scope.
    if (checkLocsExist && loc.startsWith(`${CANONICAL_ORIGIN}/`)) {
      const relTarget = loc.slice(CANONICAL_ORIGIN.length + 1);
      if (relTarget.endsWith(".xml") && !DYNAMIC_SITEMAPS.includes(relTarget)) {
        const exists = await fileExists(resolve(publicDir, relTarget));
        if (!exists)
          fail(relPath, `references "${relTarget}", which does not exist in the build output`);
      }
    }
  }

  return locs;
}

async function validateRobotsTxt(publicDir) {
  const relPath = "robots.txt";
  const path = resolve(publicDir, relPath);
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch {
    fail(relPath, "file is missing from the build output");
    return;
  }
  let hadError = false;
  const localFail = (message) => {
    hadError = true;
    fail(relPath, message);
  };
  if (content.includes(FORBIDDEN_DOMAIN)) {
    localFail(`contains a reference to the old domain "${FORBIDDEN_DOMAIN}"`);
  }
  const expectedSitemapLine = `Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`;
  if (!content.includes(expectedSitemapLine)) {
    localFail(`missing exact line "${expectedSitemapLine}"`);
  } else {
    ok(relPath, `declares "${expectedSitemapLine}"`);
  }
  for (const prefix of DISALLOWED_PATH_PREFIXES) {
    if (!content.includes(`Disallow: ${prefix}`)) {
      localFail(`missing "Disallow: ${prefix}"`);
    }
  }
  if (!hadError) ok(relPath, "content checks passed");
}

const { publicDir, preset } = await resolveNitroPublicDir(ROOT_DIR);
console.log(`[seo:validate] Nitro preset "${preset}" -- validating ${publicDir}`);

await validateRobotsTxt(publicDir);
await validateXmlFile(publicDir, "sitemap-food.xml", { checkLocsExist: false });
await validateXmlFile(publicDir, "sitemap-marketplace.xml", { checkLocsExist: false });
const indexLocs = await validateXmlFile(publicDir, "sitemap.xml", { checkLocsExist: true });
if (!indexLocs.some((loc) => loc === `${CANONICAL_ORIGIN}/sitemap-food.xml`)) {
  fail("sitemap.xml", `does not reference "${CANONICAL_ORIGIN}/sitemap-food.xml"`);
}
if (!indexLocs.some((loc) => loc === `${CANONICAL_ORIGIN}/sitemap-marketplace.xml`)) {
  fail("sitemap.xml", `does not reference "${CANONICAL_ORIGIN}/sitemap-marketplace.xml"`);
}
if (!indexLocs.some((loc) => loc === `${CANONICAL_ORIGIN}/sitemap-restaurants.xml`)) {
  fail("sitemap.xml", `does not reference "${CANONICAL_ORIGIN}/sitemap-restaurants.xml"`);
}

// The single-source-of-truth guard: restaurant tenants are served live by
// server/sitemap-restaurants.ts. If a static file ever reappears at this
// exact path (e.g. a future edit to generate-seo-files.mjs reintroducing
// per-tenant generation), it would silently shadow the dynamic route on
// Vercel's static-asset routing -- the sitemap would look fine but freeze
// back to build-time content, defeating the whole point of this
// architecture. Fail loudly instead of letting that regress silently.
for (const relPath of DYNAMIC_SITEMAPS) {
  if (await fileExists(resolve(publicDir, relPath))) {
    fail(
      relPath,
      "exists as a STATIC file in the build output, but this path must only ever be served dynamically by server/sitemap-restaurants.ts -- a static file here would shadow the live route on Vercel and freeze tenant listings until the next deploy.",
    );
  } else {
    ok(relPath, "correctly absent from the static build output (served dynamically instead)");
  }
}

console.log("");
for (const line of passed) console.log(`  PASS  ${line}`);
for (const line of errors) console.log(`  FAIL  ${line}`);
console.log("");
console.log(`[seo:validate] ${passed.length} check(s) passed, ${errors.length} failed.`);

if (errors.length > 0) {
  console.error("[seo:validate] SEO file validation failed -- see FAIL lines above.");
  process.exit(1);
}
