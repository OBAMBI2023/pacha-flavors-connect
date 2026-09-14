// Generates <publicDir>/sw.js after `vite build`, then copies the result
// onto public/sw.js (source).
//
// vite-plugin-pwa's own closeBundle hook (which normally calls this same
// workbox-build API) only runs when it sees `viteConfig.build.ssr === false`
// -- a check written for a single-environment `vite build`. TanStack Start
// drives Vite's Environment API (a client build *and* an ssr build in one
// `vite build` invocation), and the config object the plugin captures never
// satisfies that check in either environment here, so `sw.js` silently never
// gets written by the plugin. Calling workbox-build directly, post-build,
// sidesteps that broken hook entirely -- see vite.config.ts for the
// (disabled) `workbox` options this mirrors.
//
// <publicDir> is resolved from Nitro's own build bookkeeping (see
// scripts/lib/nitro-output.mjs), never hardcoded -- Nitro's preset changes
// the output layout entirely depending on where the build runs (locally:
// `.output/public/`; on Vercel: `.vercel/output/static/`). A hardcoded
// `.output/public/` here is exactly the class of bug that shipped a stale
// sitemap.xml to production (see scripts/generate-seo-files.mjs's header
// comment) -- on a Vercel build, writes would land in a directory Vercel
// never deploys, leaving whatever sw.js happened to already be sitting in
// `.vercel/output/static/` (copied from public/ during the Nitro build
// step, before this script ever runs) as what actually ships.
//
// The copy onto public/sw.js (source) below is not cosmetic: Nitro's
// node-server preset builds its static-asset route table during `vite
// build`, and every entry in that table (confirmed for all ~194 public
// assets, not just this one) resolves back to a fixed `../public/<file>`
// path relative to the compiled server bundle -- i.e. the *source* public/
// directory, never `.output/public/`. Writing only to `<publicDir>/sw.js`
// (as this script did previously, before this comment was updated) leaves
// the placeholder from public/sw.js as the only thing ever actually served
// under that preset, silently -- no error, just the wrong 355-byte file
// forever, verified live against a running `.output/server/index.mjs` by
// editing both copies independently. Harmless to also do on a Vercel build
// (an ephemeral container -- the write to public/sw.js there never reaches
// git or a future deploy either way). Same reasoning applies to
// scripts/generate-seo-files.mjs's robots.txt/sitemap output, which is not
// touched here (out of scope for the PWA layer).
import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { generateSW } from "workbox-build";
import { resolveNitroPublicDir } from "./lib/nitro-output.mjs";

const ROOT_DIR = resolve(fileURLToPath(import.meta.url), "../..");
const { publicDir: PUBLIC_DIR, preset } = await resolveNitroPublicDir(ROOT_DIR);
console.log(`[generate-sw] Nitro preset "${preset}" -- writing sw.js to ${PUBLIC_DIR}`);

// Keep in sync with scripts/generate-seo-files.mjs's DISALLOWED_PATHS.
// These are excluded from the offline-fallback navigation rule below (not
// from the SW entirely) -- a network failure while loading /admin should
// never silently show the public "vous êtes hors ligne" page instead of
// whatever the real admin auth/loading state would be.
const PRIVATE_ROUTE_PATTERNS = [
  /^\/admin/,
  /^\/super-admin/,
  /^\/auth/,
  /^\/commande/,
  /^\/commandes/,
  /^\/livreur/,
  /^\/deliver/,
  /^\/delivery/,
];

const { count, size, warnings } = await generateSW({
  globDirectory: PUBLIC_DIR,
  // "*.html" (non-recursive) matches only the standalone offline.html at the
  // client root -- route HTML is server-rendered per request (tenant menu,
  // order confirmation, auth state) and TanStack Start never writes any of
  // it into <publicDir> as static files, so there's nothing else for this
  // pattern to accidentally catch. offline.html itself must stay precached:
  // the navigation runtimeCaching rule below resolves it via `caches.match`,
  // which needs the target to already be in the precache.
  globPatterns: ["assets/**/*.{js,css,woff,woff2}", "icons/**/*.png", "*.html"],
  swDest: resolve(PUBLIC_DIR, "sw.js"),
  // A previous install can be superseded (see PwaUpdatePrompt.tsx's manual
  // "prompt" flow -- this never force-activates), but once a new SW *does*
  // take over, it must not leave old, now-unreferenced precache caches
  // sitting in storage indefinitely.
  cleanupOutdatedCaches: true,
  // Deliberately NOT skipWaiting here (see the module doc comment) -- but
  // once a new SW does activate (prompt accepted, or every tab closed), it
  // should take control of any already-open tabs immediately rather than
  // requiring yet another reload of each one.
  clientsClaim: true,
  importScripts: ["sw-push.js"],
  runtimeCaching: [
    {
      // Real offline fallback -- NOT the "always serve this instead of the
      // network" SPA app-shell pattern that `navigateFallback` gives you.
      // This app is server-rendered per route (tenant menus, auth state,
      // order confirmations); every navigation must hit the network first,
      // exactly like a plain page load would. offline.html is only ever
      // shown when that fetch genuinely throws (no connectivity) --
      // `handlerDidError` is Workbox's documented "offline fallback" hook,
      // never a proactive cache-first substitute for the real page.
      urlPattern: ({ request, url }) =>
        request.mode === "navigate" && !PRIVATE_ROUTE_PATTERNS.some((re) => re.test(url.pathname)),
      handler: "NetworkOnly",
      options: {
        plugins: [
          {
            handlerDidError: async () => caches.match("/offline.html"),
          },
        ],
      },
    },
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Documentation/defense-in-depth: order, auth and realtime data must
      // never be cached. Cross-origin already, so this is never actually
      // reached by the image rule above, but it makes the intent explicit.
      urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/(rest|auth|realtime)\//,
      handler: "NetworkOnly",
    },
  ],
});

for (const warning of warnings) console.warn("[generate-sw]", warning);
console.log(
  `[generate-sw] wrote ${PUBLIC_DIR}/sw.js -- ${count} files precached, ${(size / 1024).toFixed(1)} KB`,
);

await copyFile(resolve(PUBLIC_DIR, "sw.js"), resolve(ROOT_DIR, "public/sw.js"));
console.log(
  "[generate-sw] copied to public/sw.js (source) -- see this file's header comment for why",
);
