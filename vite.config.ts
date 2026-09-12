import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import { nitro } from "nitro/vite";

export default defineConfig({
  // `npm run dev` (plain `vite dev`) binds to localhost only by default --
  // LAN origins like http://192.168.1.79:5173 need this to be reachable
  // without manually passing --host every time.
  server: {
    host: true,
    watch: {
      // Nitro's dev integration continuously regenerates files under
      // .output/ (public assets, SSR manifest). Without this exclusion,
      // Vite's own watcher (chokidar/fs.watch) picks up those writes as
      // public-dir changes and triggers a full reload, which races Nitro's
      // next write -- on Windows this write/watch collision surfaces as
      // EBUSY: resource busy or locked and can crash the dev server.
      ignored: ["**/.output/**"],
    },
  },
  optimizeDeps: {
    // maplibre-gl loads its own worker as a sibling module
    // (maplibre-gl-worker.mjs) resolved relative to its own module URL. Vite
    // dev's esbuild pre-bundler only pre-bundles the main "maplibre-gl"
    // entry into node_modules/.vite/deps/, never that worker sub-module, so
    // the sibling path it computes 404s there and the worker never gets its
    // code -- the map then sits on a correctly-sized, empty WebGL canvas
    // (style/sprites/tiles-source all fetch fine; zero .pbf tile requests
    // ever fire since tile loading is gated on the worker). Excluding it
    // here makes Vite serve it straight from node_modules instead, where
    // its relative worker path resolves for real. Production builds are
    // unaffected (Rollup inlines the worker code into the bundle instead).
    exclude: ["maplibre-gl"],
  },
  plugins: [
    tanstackStart(),
    nitro({
      rolldownConfig: {
        output: {
          preserveModules: true,
        },
      },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      // Manual registration (src/components/pwa/PwaUpdatePrompt.tsx) so the
      // update prompt can be offered via a toast instead of force-reloading
      // mid-checkout.
      injectRegister: false,
      registerType: "prompt",
      // Off by default in vite-plugin-pwa; opted in so manifest/SW can be
      // smoke-tested against `vite dev` too, not just the production build.
      devOptions: { enabled: true },
      // Keep this content identical to public/manifest.webmanifest (and to
      // the theme-color meta tag in src/routes/__root.tsx) -- two different
      // things in this build actually answer a `/manifest.webmanifest`
      // request, and which one wins isn't reliably one or the other:
      //   1. This option feeds vite-plugin-pwa's `apply: "serve"` dev
      //      middleware (vite-plugin-pwa/dist/index.js's DevPlugin,
      //      `configureServer` -> `generateWebManifestFile(options)`) --
      //      meant for `vite dev` only, but confirmed live against a real
      //      `node .output/server/index.mjs` production build to still be
      //      what answers the request (returning `manifest: false`'s
      //      "couldn't find configuration for precaching" error at build
      //      time proves this option is read at all; the response content
      //      matching this option's fields, merged with the plugin's
      //      package.json-derived defaults, proves this exact code path
      //      runs in the compiled server). Almost certainly the same
      //      `apply`/command-detection confusion as the `workbox` comment
      //      below documents for the closeBundle hook -- TanStack Start's
      //      multi-environment `vite build` doesn't look like a single
      //      `command: "build"` invocation the way this plugin expects.
      //   2. public/manifest.webmanifest is a plain static file, served
      //      whenever Nitro's own static-asset route table gets to answer
      //      first instead (confirmed for /sw.js in the same build; not
      //      reliably reproduced for the manifest specifically, hence
      //      keeping both in sync rather than trusting either alone).
      manifest: {
        name: "SAOVIA Food",
        short_name: "SAOVIA Food",
        description: "SAOVIA Food : menu digital, commande en ligne et livraison pour restaurants.",
        lang: "fr",
        dir: "ltr",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        theme_color: "#32190c",
        background_color: "#ffffff",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      //
      // No `workbox` option here either: TanStack Start builds through
      // Vite's Environment API (a client + an ssr build in one `vite
      // build`), and this plugin's own service-worker generation only fires
      // when its captured config satisfies a single-environment
      // `build.ssr === false` check that never holds in either environment
      // here -- so `sw.js` silently never gets written by this plugin. The
      // actual service worker is generated by `scripts/generate-sw.mjs`
      // (same workbox-build API this plugin would have called), which
      // writes straight to public/sw.js (source) for the same route-binding
      // reason as the manifest above -- see `npm run build`.
    }),
  ],
});
