// Resolves the public asset directory Nitro actually wrote its last build
// to -- preset-agnostic, so callers never have to guess or hardcode a path.
//
// Nitro's preset changes the output layout entirely depending on where the
// build runs: locally (no VERCEL env var) it auto-detects the "node-server"
// preset and writes static assets to `.output/public/`; on Vercel's build
// containers (VERCEL=1) it auto-detects the "vercel" preset instead and
// writes to `.vercel/output/static/` -- a completely different directory
// that `.output/public/` writes never reach. A postbuild script that hardcodes
// `.output/public/` therefore silently writes into a directory Vercel never
// deploys, and the placeholder files committed to `public/` (needed only so
// Nitro registers routes for them at all) ship to production untouched.
//
// Rather than re-deriving that preset-detection logic (env-var sniffing that
// would drift from whatever Nitro itself actually decided), this reads
// Nitro's own build bookkeeping, written by every preset at the end of its
// build: `node_modules/.nitro/last-build.json` (which output dir the most
// recent build used) and `<output dir>/nitro.json` (that build's resolved
// `publicDir`, plus which preset produced it). This is guaranteed to point at
// whatever was actually just built, whichever preset ran.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export class NitroOutputError extends Error {}

/**
 * @param {string} rootDir - project root (contains node_modules/)
 * @returns {Promise<{ outputDir: string, publicDir: string, preset: string }>}
 */
export async function resolveNitroPublicDir(rootDir) {
  const lastBuildPath = resolve(rootDir, "node_modules/.nitro/last-build.json");
  let lastBuild;
  try {
    lastBuild = JSON.parse(await readFile(lastBuildPath, "utf8"));
  } catch (cause) {
    throw new NitroOutputError(
      `Could not read ${lastBuildPath}. Run \`vite build\` (which runs the Nitro build) before this script -- ` +
        `it needs Nitro's own build-info pointer to know which output directory the current preset actually used.`,
      { cause },
    );
  }
  if (!lastBuild.outputDir) {
    throw new NitroOutputError(
      `${lastBuildPath} has no "outputDir" field -- unexpected Nitro build-info format.`,
    );
  }
  // Resolved against lastBuildPath itself (the file path, including its own
  // filename), not its dirname -- this matches Nitro's own resolution of
  // this exact field (see findLastBuildDir() in nitro's build/common.mjs,
  // `resolve(lastBuildLink, data.outputDir)`), and its "../../../.output"
  // default is calibrated for that. Stripping the filename first (an
  // extra directory level) resolves one level too high.
  const outputDir = resolve(lastBuildPath, lastBuild.outputDir);

  const nitroJsonPath = resolve(outputDir, "nitro.json");
  let buildInfo;
  try {
    buildInfo = JSON.parse(await readFile(nitroJsonPath, "utf8"));
  } catch (cause) {
    throw new NitroOutputError(
      `Could not read ${nitroJsonPath} -- Nitro build info missing or incomplete.`,
      { cause },
    );
  }
  if (!buildInfo.publicDir) {
    throw new NitroOutputError(
      `${nitroJsonPath} has no "publicDir" field -- unexpected Nitro build-info format.`,
    );
  }

  return {
    outputDir,
    publicDir: resolve(outputDir, buildInfo.publicDir),
    preset: buildInfo.preset ?? "unknown",
  };
}
