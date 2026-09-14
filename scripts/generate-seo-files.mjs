// Generates <publicDir>/robots.txt, <publicDir>/sitemap-food.xml (the
// static SAOVIA Food marketing pages + every /food/conseils article),
// <publicDir>/sitemap.xml (a sitemap index referencing sitemap-food.xml
// plus one <publicDir>/sitemaps/<slug>.xml per public tenant), after
// `vite build` -- automatic on every deploy, no manual step.
//
// <publicDir> is resolved from Nitro's own build bookkeeping (see
// scripts/lib/nitro-output.mjs), never hardcoded -- Nitro's preset changes
// the output layout entirely depending on where the build runs (locally:
// `.output/public/`; on Vercel: `.vercel/output/static/`), and a hardcoded
// path here previously meant every write in production landed in a
// directory Vercel never deploys, silently leaving the placeholder files
// committed under public/ (see git history) as what actually shipped.
//
// robots.txt and sitemap-food.xml have no Supabase dependency and are
// always written, even when Supabase env vars aren't configured (e.g. local
// dev) -- only the per-tenant sitemaps genuinely need Supabase, and degrade
// gracefully (a sitemap.xml with just the food entry, zero tenant entries)
// when it's unavailable, instead of the whole script exiting before writing
// anything.
//
// This TanStack Start version (see vite.config.ts / generate-sw.mjs) has no
// dynamic API-route support, so a true per-request /sitemap.xml handler
// isn't available from application code. Static files regenerated on every
// build is the closest safe equivalent -- same reasoning, same postbuild
// pattern already used for the PWA service worker.
//
// Per-tenant sitemaps read only via get_public_sitemap_index, the same
// security-definer, tenant-scoped (is_public = true, status = 'active') RPC
// family the storefront itself uses -- never touches orders, customers, or
// Admin data, and the anon/publishable key is all this needs (no service
// role).
//
// Keep the canonical-URL logic below in sync with src/lib/seo.ts's
// tenantCanonicalUrl, and CONSEIL_ARTICLE_SLUGS below in sync with
// src/lib/food-conseils.ts's CONSEIL_ARTICLES -- duplicated here only
// because this plain Node script (run directly, not through Vite/tsx) can't
// resolve the app's `@/` path aliases or import .ts source.
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { resolveNitroPublicDir } from "./lib/nitro-output.mjs";

const ROOT_DIR = resolve(fileURLToPath(import.meta.url), "../..");
const { publicDir: PUBLIC_DIR, preset } = await resolveNitroPublicDir(ROOT_DIR);
console.log(`[generate-seo-files] Nitro preset "${preset}" -- writing SEO files to ${PUBLIC_DIR}`);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SITE_URL = (process.env.VITE_SITE_URL || "https://food.saovia.net").replace(/\/+$/, "");

// Static SAOVIA Food marketing pages -- no DB dependency, so these (and the
// robots.txt/sitemap-food.xml/sitemap.xml files below) must be written
// unconditionally, never gated behind Supabase being configured. Only the
// per-tenant storefront sitemaps further down genuinely need Supabase.
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
// the app's `@/` path aliases or import .ts source -- see this file's own
// note further down about tenantCanonicalUrl. Same reasoning here: this is
// a thin, sitemap-only mirror of src/lib/food-conseils.ts's CONSEIL_ARTICLES
// (slug + updatedAt only). Adding an article there must add its slug here
// too for it to appear in sitemap-food.xml.
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

function tenantOrigin(tenant) {
  return tenant.custom_domain ? `https://${tenant.custom_domain}` : SITE_URL;
}

/** Mirrors src/lib/seo.ts's tenantCanonicalUrl: root path on a custom domain, `/r/<slug>` on the shared domain. Since Phase 3U, "/" is the SAOVIA Food B2B homepage for every tenant -- no tenant is excluded from this list anymore. */
function tenantCanonicalUrl(tenant) {
  const origin = tenantOrigin(tenant);
  return tenant.custom_domain ? `${origin}/` : `${origin}/r/${tenant.slug}`;
}

function lastmodOf(tenant) {
  if (!tenant.updated_at) return null;
  const date = new Date(tenant.updated_at);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
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
// No Supabase dependency -- /food, /food-signup, /food/conseils and every
// article slug above are plain static routes, so this file is always
// written, even when Supabase env vars aren't configured (e.g. local dev).
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

// --- per-tenant sitemap -------------------------------------------------
// Only that tenant's own public URL(s) -- today just its storefront root
// (no separate indexable product/category routes exist yet), but written
// as one file per tenant so a future per-product URL only ever needs to be
// added to its own tenant's file.
async function writeTenantSitemap(tenant) {
  const loc = tenantCanonicalUrl(tenant);
  const lastmod = lastmodOf(tenant);
  const urlEntry = [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    "    <changefreq>daily</changefreq>",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntry}\n</urlset>\n`;
  await writeFile(resolve(PUBLIC_DIR, "sitemaps", `${tenant.slug}.xml`), xml, "utf8");
}

// --- sitemap index --------------------------------------------------------
function sitemapIndexEntry(tenant) {
  const origin = tenantOrigin(tenant);
  const loc = tenant.custom_domain
    ? `${origin}/sitemap.xml`
    : `${SITE_URL}/sitemaps/${tenant.slug}.xml`;
  const lastmod = lastmodOf(tenant);
  return [
    "  <sitemap>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    "  </sitemap>",
  ]
    .filter(Boolean)
    .join("\n");
}

// --- always-on static output (no Supabase needed) -------------------------
await mkdir(resolve(PUBLIC_DIR, "sitemaps"), { recursive: true });
await writeFile(resolve(PUBLIC_DIR, "robots.txt"), robotsLines.join("\n"), "utf8");
await writeFile(resolve(PUBLIC_DIR, "sitemap-food.xml"), staticMarketingSitemapXml(), "utf8");
await writeFile(
  resolve(PUBLIC_DIR, "sitemap-marketplace.xml"),
  staticMarketplaceSitemapXml(),
  "utf8",
);

// --- per-tenant output (needs Supabase; degrades gracefully without it) ---
let tenants = [];
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("[generate-seo-files] Missing Supabase env vars -- skipping per-tenant sitemaps.");
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.rpc("get_public_sitemap_index");
  if (error) {
    console.error("[generate-seo-files] get_public_sitemap_index failed:", error.message);
  } else {
    tenants = data ?? [];
  }
}

const foodSitemapEntry = [
  "  <sitemap>",
  `    <loc>${xmlEscape(`${SITE_URL}/sitemap-food.xml`)}</loc>`,
  "  </sitemap>",
].join("\n");
const marketplaceSitemapEntry = [
  "  <sitemap>",
  `    <loc>${xmlEscape(`${SITE_URL}/sitemap-marketplace.xml`)}</loc>`,
  "  </sitemap>",
].join("\n");
const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
  foodSitemapEntry,
  marketplaceSitemapEntry,
  ...tenants.map(sitemapIndexEntry),
].join("\n")}\n</sitemapindex>\n`;
await writeFile(resolve(PUBLIC_DIR, "sitemap.xml"), indexXml, "utf8");

await Promise.all(tenants.map(writeTenantSitemap));

console.log(
  `[generate-seo-files] wrote ${PUBLIC_DIR}/robots.txt, sitemap.xml, sitemap-food.xml, sitemap-marketplace.xml, and ${tenants.length} tenant sitemap(s).`,
);
