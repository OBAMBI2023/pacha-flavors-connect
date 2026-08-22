// Generates dist/client/sw.js after `vite build`.
//
// vite-plugin-pwa's own closeBundle hook (which normally calls this same
// workbox-build API) only runs when it sees `viteConfig.build.ssr === false`
// -- a check written for a single-environment `vite build`. TanStack Start
// drives Vite's Environment API (a client build *and* an ssr build in one
// `vite build` invocation), and the config object the plugin captures never
// satisfies that check in either environment here, so `sw.js` silently never
// gets written even though `manifest.webmanifest` (an unconditional
// `generateBundle` hook) does. Calling workbox-build directly, post-build,
// sidesteps that broken hook entirely -- see vite.config.ts for the
// (disabled) `workbox` options this mirrors.
import { generateSW } from "workbox-build";

const { count, size, warnings } = await generateSW({
  globDirectory: "dist/client",
  // "*.html" (non-recursive) matches only the standalone offline.html at the
  // client root -- route HTML is server-rendered per request (tenant menu,
  // order confirmation, auth state) and TanStack Start never writes any of
  // it into dist/client as static files, so there's nothing else for this
  // pattern to accidentally catch. offline.html itself must be precached:
  // `navigateFallback` below resolves it via `createHandlerBoundToURL`,
  // which requires the target to already be in the precache.
  globPatterns: ["assets/**/*.{js,css,woff,woff2}", "icons/**/*.png", "*.html"],
  swDest: "dist/client/sw.js",
  navigateFallback: "/offline.html",
  navigateFallbackDenylist: [/^\/admin/, /^\/super-admin/, /^\/auth/],
  importScripts: ["sw-push.js"],
  runtimeCaching: [
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
console.log(`[generate-sw] wrote dist/client/sw.js -- ${count} files precached, ${(size / 1024).toFixed(1)} KB`);
