// Generates <publicDir>/robots.txt, <publicDir>/sitemap-food.xml,
// <publicDir>/sitemap-marketplace.xml and <publicDir>/sitemap.xml (a fixed
// sitemap index) after `vite build` -- automatic on every deploy, no manual
// step. All four are purely static content with no Supabase dependency.
//
// Restaurant tenants are deliberately NOT generated here anymore. They used
// to be (one <publicDir>/sitemaps/<slug>.xml file per public tenant, written
// from a build-time Supabase read), which meant a newly published tenant
// only appeared in the sitemap after the next git push + Vercel deploy --
// unacceptable for a SaaS where restaurants can be published any time of
// day. That per-tenant listing is now served at request time by
// server/sitemap-restaurants.ts (registered in vite.config.ts's
// `nitro({ routes })`), reading the exact same get_public_sitemap_index()
// RPC live, cached at Vercel's edge for a few minutes (see that file's own
// comments) instead of frozen until the next deploy. sitemap.xml below just
// references that dynamic URL by a fixed path -- it never needs to change
// when a tenant is published, suspended, or removed, so it can stay a plain
// static file like everything else here.
//
// This is the single source of truth split: build-time static files (this
// script) vs. one request-time dynamic file (server/sitemap-restaurants.ts).
// Nothing here may ever write a competing sitemap-restaurants.xml (or a
// sitemaps/ directory) to <publicDir> -- scripts/validate-seo-files.mjs
// enforces that a static file never shadows it (see NEVER_STATIC_SITEMAPS
// there).
//
// <publicDir> is resolved from Nitro's own build bookkeeping (see
// scripts/lib/nitro-output.mjs), never hardcoded -- Nitro's preset changes
// the output layout entirely depending on where the build runs (locally:
// `.output/public/`; on Vercel: `.vercel/output/static/`), and a hardcoded
// path here previously meant every write in production landed in a
// directory Vercel never deploys, silently leaving the placeholder files
// committed under public/ (see git history) as what actually shipped.
//
// Keep CONSEIL_ARTICLE_SLUGS below in sync with src/lib/food-conseils.ts's
// CONSEIL_ARTICLES -- duplicated here only because this plain Node script
// (run directly, not through Vite/tsx) can't resolve the app's `@/` path
// aliases or import .ts source.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { resolveNitroPublicDir } from "./lib/nitro-output.mjs";

const ROOT_DIR = resolve(fileURLToPath(import.meta.url), "../..");
const { publicDir: PUBLIC_DIR, preset } = await resolveNitroPublicDir(ROOT_DIR);
console.log(`[generate-seo-files] Nitro preset "${preset}" -- writing SEO files to ${PUBLIC_DIR}`);

const SITE_URL = (process.env.VITE_SITE_URL || "https://food.saovia.net").replace(/\/+$/, "");

// Static SAOVIA Food marketing pages -- no DB dependency.
//
// /food is deliberately absent: since Phase 3U (see src/routes/food.tsx) it
// permanently 301-redirects to "/", the real indexable B2B homepage -- kept
// as a redirect stub only so old links/bookmarks still work. A redirecting
// URL must never be the <loc> of a sitemap entry (Search Console audit,
// 2026-09-14, flagged this exact case as "Google ne reconnaît pas cette
// URL"): the sitemap should only ever point at the page actually meant to be
// indexed, i.e. "/" itself (already covered by STATIC_MARKETPLACE_PATHS).
const STATIC_MARKETING_PATHS = ["/food-signup", "/food/conseils"];

// The marketplace/homepage surface (src/routes/index.tsx, restaurants.tsx,
// rechercher.tsx) is indexable but was previously absent from every
// sitemap. No DB dependency, same reasoning as STATIC_MARKETING_PATHS above.
const STATIC_MARKETPLACE_PATHS = ["/", "/restaurants", "/rechercher"];

// This plain Node script (run directly, not through Vite/tsx) can't resolve
// the app's `@/` path aliases or import .ts source -- this is a thin,
// sitemap-only mirror of src/lib/food-conseils.ts's CONSEIL_ARTICLES (slug +
// updatedAt only). Adding an article there must add its slug here too for it
// to appear in sitemap-food.xml.
const CONSEIL_ARTICLE_SLUGS = [
  { slug: "attirer-plus-de-clients-restaurant", updatedAt: "2026-09-05" },
  { slug: "menu-digital-restaurant", updatedAt: "2026-09-02" },
  { slug: "augmenter-commandes-restaurant-digital", updatedAt: "2026-08-28" },
  { slug: "qr-code-restaurant", updatedAt: "2026-09-08" },
  { slug: "commande-en-ligne-restaurant", updatedAt: "2026-09-06" },
  { slug: "digitaliser-restaurant-cote-divoire", updatedAt: "2026-09-04" },
  { slug: "attirer-clients-restaurant-abidjan", updatedAt: "2026-09-03" },
  { slug: "meta-ads-restaurant", updatedAt: "2026-09-01" },
  { slug: "instagram-restaurant", updatedAt: "2026-08-30" },
  { slug: "fideliser-clients-restaurant", updatedAt: "2026-08-26" },
];

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// --- robots.txt -------------------------------------------------------
// Allows every public tenant storefront and the marketplace; disallows
// every Admin/authenticated/customer-personal-data surface. Same private
// route set already documented in generate-sw.mjs's navigateFallbackDenylist.
const DISALLOWED_PATHS = [
  "/admin",
  "/super-admin",
  "/auth",
  "/commande", // order confirmation -- tied to one customer's own order
  "/commandes", // customer's own order history
  "/livreur",
  "/deliver",
  "/delivery",
];

const robotsLines = [
  "User-agent: *",
  "Allow: /",
  ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
  "",
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  "",
];

// --- static marketing sitemap (sitemap-food.xml) -------------------------
function staticMarketingSitemapXml() {
  const staticEntries = STATIC_MARKETING_PATHS.map(
    (path) =>
      `  <url>\n    <loc>${xmlEscape(`${SITE_URL}${path}`)}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`,
  );
  const articleEntries = CONSEIL_ARTICLE_SLUGS.map(
    ({ slug, updatedAt }) =>
      `  <url>\n    <loc>${xmlEscape(`${SITE_URL}/food/conseils/${slug}`)}</loc>\n    <lastmod>${updatedAt}</lastmod>\n    <changefreq>monthly</changefreq>\n  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticEntries, ...articleEntries].join("\n")}\n</urlset>\n`;
}

// --- static marketplace sitemap (sitemap-marketplace.xml) -----------------
function staticMarketplaceSitemapXml() {
  const entries = STATIC_MARKETPLACE_PATHS.map(
    (path) =>
      `  <url>\n    <loc>${xmlEscape(`${SITE_URL}${path}`)}</loc>\n    <changefreq>daily</changefreq>\n  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}

// --- sitemap index ---------------------------------------------------------
// Fixed, 3-entry index: two static sub-sitemaps plus the one dynamic,
// request-time sub-sitemap (server/sitemap-restaurants.ts). None of these
// three URLs ever change, so this file needs no Supabase access and never
// needs regenerating when a tenant is published/suspended/removed -- only
// the *content* /sitemap-restaurants.xml itself returns changes, live.
function sitemapIndexXml() {
  const entries = [
    `${SITE_URL}/sitemap-food.xml`,
    `${SITE_URL}/sitemap-marketplace.xml`,
    `${SITE_URL}/sitemap-restaurants.xml`,
  ].map((loc) => `  <sitemap>\n    <loc>${xmlEscape(loc)}</loc>\n  </sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>\n`;
}

await mkdir(PUBLIC_DIR, { recursive: true });
await writeFile(resolve(PUBLIC_DIR, "robots.txt"), robotsLines.join("\n"), "utf8");
await writeFile(resolve(PUBLIC_DIR, "sitemap-food.xml"), staticMarketingSitemapXml(), "utf8");
await writeFile(
  resolve(PUBLIC_DIR, "sitemap-marketplace.xml"),
  staticMarketplaceSitemapXml(),
  "utf8",
);
await writeFile(resolve(PUBLIC_DIR, "sitemap.xml"), sitemapIndexXml(), "utf8");

console.log(
  `[generate-seo-files] wrote ${PUBLIC_DIR}/robots.txt, sitemap.xml, sitemap-food.xml, sitemap-marketplace.xml (sitemap-restaurants.xml is served dynamically by server/sitemap-restaurants.ts, not written here).`,
);
