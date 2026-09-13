// Generates public/assets/maplibre-gl-worker.mjs before `vite build` runs, so
// it's always a fresh, self-contained bundle of the installed maplibre-gl
// version rather than a hand-copied static file that can silently drift out
// of sync.
//
// maplibre-gl's own dist/maplibre-gl-worker.mjs has a top-level static ES
// import of a sibling file, `./maplibre-gl-shared.mjs` (code shared with the
// main-thread bundle). Vite/Rollup's `new URL(..., import.meta.url)`
// static-asset detection can't see that reference (it's inside an
// already-built npm package, not source Vite compiles), so neither file ever
// made it into the app's own build automatically -- both had to be vendored
// as static public/ assets by hand instead (see the optimizeDeps comment in
// vite.config.ts).
//
// That fixed the 404, but not a second, separate failure: a dedicated Web
// Worker's own static nested import of a same-origin file fails to resolve
// on Vercel specifically, where that file is served Brotli-compressed
// (chunked transfer) -- confirmed live: the exact same bytes load fine via
// fetch(), dynamic import(), a main-document static import, or as a worker's
// own top-level entry script; only "worker entry -> static nested import ->
// separate URL" fails, and only under Vercel's compression. Setting
// Cache-Control: no-transform on that path (vite.config.ts's
// `nitro.vercel.config.routes`) did not stop Vercel from compressing it
// anyway, so the fix has to remove the nested import itself rather than try
// to control how its response is served.
//
// Rather than hand-splicing the two files (fragile, and would silently break
// on the next maplibre-gl upgrade), this uses Rollup -- already a project
// dependency -- to bundle the real worker entry point, letting it resolve
// and inline `./maplibre-gl-shared.mjs` the normal way a bundler does: real
// scope hygiene, dead-export tree-shaking, no manual renaming. The output is
// a single self-contained ES module with zero remaining references to
// maplibre-gl-shared.mjs, so the worker no longer needs a second network
// request (of any kind) to become functional. public/assets/maplibre-gl-shared.mjs
// stays vendored as-is for now (unused by the worker after this change, but
// harmless, and nothing else in this repo reads this script's output) --
// removing it is a separate decision.
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { rollup } from "rollup";

const entry = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
const outFile = "public/assets/maplibre-gl-worker.mjs";

const bundle = await rollup({
  input: entry,
  onwarn(warning) {
    // Any warning here (circular deps, eval, unresolved imports, ...) means
    // this bundle needs a human look before it's trusted -- fail the build
    // instead of shipping a silently-off worker.
    throw new Error(`[vendor-maplibre-worker] unexpected Rollup warning while bundling ${entry}: ${warning.code} ${warning.message}`);
  },
});
const { output } = await bundle.generate({ format: "es" });
await bundle.close();

const code = output[0].code;

if (code.includes("maplibre-gl-shared")) {
  throw new Error(
    "[vendor-maplibre-worker] bundled worker still references maplibre-gl-shared.mjs -- inlining failed, refusing to write a broken file.",
  );
}

await writeFile(outFile, code);

const hash = createHash("md5").update(code).digest("hex");
console.log(
  `[vendor-maplibre-worker] wrote ${outFile} -- ${(code.length / 1024).toFixed(1)} KB, md5 ${hash}, self-contained (no maplibre-gl-shared.mjs reference)`,
);
