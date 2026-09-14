// Fails the build if public/sw.js (or rather, <publicDir>/sw.js -- the file
// that actually gets packaged for deployment) precaches any URL that isn't
// really present in this same build's output.
//
// This is exactly the bug class that let a stale sw.js -- referencing a
// PREVIOUS deployment's hashed JS/CSS chunk names -- ship to production:
// browsers that had already installed an older service worker tried to
// install what looked like a "new" one (still stale, but byte-different from
// what they had), Workbox's precaching install step 404'd on the missing
// chunks, the install failed, and the browser was stuck on whatever it had
// before -- with no successful update ever able to complete. Run this as the
// LAST step of `npm run build`, after generate-sw.mjs, so it inspects the
// real, final output tree that actually gets deployed.
//
// <publicDir> is resolved from Nitro's own build bookkeeping the exact same
// way generate-sw.mjs resolves where it wrote sw.js (see
// scripts/lib/nitro-output.mjs) -- never hardcoded, so this always checks
// the build Vercel will actually deploy (`.vercel/output/static/` there,
// `.output/public/` for a local node-server build), not a directory that
// happens to exist locally but was never what shipped.
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNitroPublicDir } from "./lib/nitro-output.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(import.meta.url), "../..");
const { publicDir: OUTPUT_DIR, preset } = await resolveNitroPublicDir(ROOT_DIR);
console.log(`[verify-sw] Nitro preset "${preset}" -- verifying ${OUTPUT_DIR}`);
const SW_PATH = path.join(OUTPUT_DIR, "sw.js");

const swSource = await readFile(SW_PATH, "utf8").catch(() => {
  console.error(
    `[verify-sw] BUILD FAILED -- ${SW_PATH} does not exist. generate-sw.mjs must run before this script.`,
  );
  process.exit(1);
});

// The generated file is a single minified line; every precached entry looks
// like {url:"assets/foo-HASH.js",revision:"..."} or {url:"icons/x.png",revision:null}.
const urlPattern = /\{url:"([^"]+)"/g;
const precachedUrls = [...swSource.matchAll(urlPattern)].map((m) => m[1]);

if (precachedUrls.length === 0) {
  console.error(
    "[verify-sw] BUILD FAILED -- no precached URLs found in sw.js. generateSW likely failed silently.",
  );
  process.exit(1);
}

const missing = [];
for (const url of precachedUrls) {
  const filePath = path.join(OUTPUT_DIR, url);
  try {
    await access(filePath, constants.F_OK);
  } catch {
    missing.push(url);
  }
}

if (missing.length > 0) {
  console.error(
    `[verify-sw] BUILD FAILED -- sw.js precaches ${missing.length} file(s) that do not exist in this build's output:`,
  );
  for (const url of missing) console.error(`  - ${url}`);
  console.error(
    "[verify-sw] A stale sw.js referencing another build's chunk hashes is exactly what breaks already-" +
      "subscribed browsers (see the sw.js/PWA diagnostic). Re-run the build; if this keeps happening, " +
      "check that nothing packages .output/ (or public/) for deployment before scripts/generate-sw.mjs runs.",
  );
  process.exit(1);
}

console.log(
  `[verify-sw] OK -- all ${precachedUrls.length} precached URLs exist in the built output.`,
);
