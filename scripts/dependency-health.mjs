// Validates that Nitro's own build-info bookkeeping (node_modules/.nitro/
// last-build.json + <outputDir>/nitro.json) resolves to a real, existing
// directory -- the exact chain every preset-agnostic postbuild script in
// this project depends on (generate-sw.mjs, verify-sw.mjs,
// generate-seo-files.mjs, validate-seo-files.mjs all call
// scripts/lib/nitro-output.mjs's resolveNitroPublicDir()).
//
// Run this right after `vite build`, before any of those scripts, so a
// broken resolution chain (e.g. a Nitro version bump changing the
// last-build.json path convention -- see nitro-output.mjs's own comment on
// how it mirrors Nitro's internal findLastBuildDir()) fails here with one
// clear message instead of four confusing, unrelated-looking errors deeper
// in the pipeline.
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { NitroOutputError, resolveNitroPublicDir } from "./lib/nitro-output.mjs";

const ROOT_DIR = resolve(fileURLToPath(import.meta.url), "../..");

try {
  const { outputDir, publicDir, preset } = await resolveNitroPublicDir(ROOT_DIR);

  const outputStat = await stat(outputDir).catch(() => null);
  if (!outputStat?.isDirectory()) {
    console.error(
      `[dependency-health] BUILD FAILED -- resolved outputDir does not exist or is not a directory: ${outputDir}`,
    );
    process.exit(1);
  }

  const publicStat = await stat(publicDir).catch(() => null);
  if (!publicStat?.isDirectory()) {
    console.error(
      `[dependency-health] BUILD FAILED -- resolved publicDir does not exist or is not a directory: ${publicDir}`,
    );
    process.exit(1);
  }

  console.log(`[dependency-health] OK -- Nitro preset "${preset}" resolved correctly.`);
  console.log(`[dependency-health]   outputDir: ${outputDir}`);
  console.log(`[dependency-health]   publicDir: ${publicDir}`);
} catch (err) {
  if (err instanceof NitroOutputError) {
    console.error(`[dependency-health] BUILD FAILED -- ${err.message}`);
  } else {
    console.error("[dependency-health] BUILD FAILED --", err);
  }
  process.exit(1);
}
