import { setWorkerUrl } from "maplibre-gl";

/**
 * Side-effect only: every module that constructs a `maplibre-gl` `Map`
 * imports this one first, so this runs exactly once (ES modules are
 * evaluated once and cached) before the first `new Map()` anywhere in the
 * app, regardless of which map-bearing route loads first.
 *
 * `?v=` is the actual worker file's own content hash, injected at build time
 * by vite.config.ts (see __MAPLIBRE_WORKER_VERSION__ there) -- it changes
 * automatically whenever scripts/vendor-maplibre-worker.mjs regenerates a
 * different worker, without touching this file. That's what actually fixes
 * stale caching: the vendored worker is served from a stable, unhashed
 * public/ path with `Cache-Control: immutable, max-age=31536000` (see
 * vite.config.ts's nitro.vercel.config.routes), so a browser that already
 * cached the old (broken) worker under that bare URL would otherwise never
 * revalidate it -- a new `?v=` is a brand-new cache key instead.
 */
setWorkerUrl(`/assets/maplibre-gl-worker.mjs?v=${__MAPLIBRE_WORKER_VERSION__}`);
