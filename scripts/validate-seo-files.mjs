// Post-build gate for the SEO files scripts/generate-seo-files.mjs writes.
// Exits non-zero (failing `npm run build`) if any of them is missing, isn't
// well-formed XML, references the wrong domain, references a private route,
// or points at a sitemap file that doesn't actually exist in the same
// output directory -- the class of bug that shipped a placeholder sitemap
// (and a robots.txt pointing at the wrong domain) to production because
// nothing checked what actually landed in the deployed output directory.
//
// Resolves the directory to check the exact same way generate-seo-files.mjs
// resolves where to write (see scripts/lib/nitro-output.mjs) -- so this
// always validates the files Vercel will actually deploy, not a directory
// that happens to exist locally.
import { readFile, readdir } from "node:fs/promises";
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
    // Only URLs on our own canonical origin are checked for on-disk
    // existence -- a tenant custom-domain <loc> (a different origin,
    // deployed by a different project) is intentionally out of scope.
    if (checkLocsExist && loc.startsWith(`${CANONICAL_ORIGIN}/`)) {
      const relTarget = loc.slice(CANONICAL_ORIGIN.length + 1);
      if (relTarget.endsWith(".xml")) {
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

// Every tenant sitemap actually written to disk must itself be valid --
// not just the ones sitemap.xml happens to reference (a sitemap.xml write
// failure shouldn't hide an invalid tenant file, and vice versa).
let tenantSitemapCount = 0;
try {
  const entries = await readdir(resolve(publicDir, "sitemaps"));
  const xmlFiles = entries.filter((f) => f.endsWith(".xml"));
  tenantSitemapCount = xmlFiles.length;
  for (const file of xmlFiles) {
    await validateXmlFile(publicDir, `sitemaps/${file}`, { checkLocsExist: false });
  }
} catch {
  // No sitemaps/ directory at all is only a problem if sitemap.xml claims
  // tenant entries that would live there -- already caught above via the
  // per-<loc> existence check.
}

console.log("");
for (const line of passed) console.log(`  PASS  ${line}`);
for (const line of errors) console.log(`  FAIL  ${line}`);
console.log("");
console.log(
  `[seo:validate] ${passed.length} check(s) passed, ${errors.length} failed, ${tenantSitemapCount} tenant sitemap(s) found.`,
);

if (errors.length > 0) {
  console.error("[seo:validate] SEO file validation failed -- see FAIL lines above.");
  process.exit(1);
}
