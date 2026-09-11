// Generates dist/client/robots.txt, dist/client/sitemap-food.xml (the
// static SAOVIA Food marketing pages + every /food/conseils article),
// dist/client/sitemap.xml (a sitemap index referencing sitemap-food.xml
// plus one dist/client/sitemaps/<slug>.xml per public tenant), after
// `vite build` -- automatic on every deploy, no manual step.
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SITE_URL = (process.env.VITE_SITE_URL || "https://pacha-flavors-connect.lovable.app").replace(/\/+$/, "");

// Static SAOVIA Food marketing pages -- no DB dependency, so these (and the
// robots.txt/sitemap-food.xml/sitemap.xml files below) must be written
// unconditionally, never gated behind Supabase being configured. Only the
// per-tenant storefront sitemaps further down genuinely need Supabase.
const STATIC_MARKETING_PATHS = ["/food", "/food-signup", "/food/conseils"];

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

// Keep in sync with src/lib/seo.ts's ROOT_PAGE_TENANT_SLUG: "le-pacha" also
// has its own dedicated page at the site root (src/routes/index.tsx),
// already listed via STATIC_MARKETPLACE_PATHS above -- excluded below so it
// isn't listed twice under two different (non-canonical vs. canonical) URLs.
const ROOT_PAGE_TENANT_SLUG = "le-pacha";

/** Mirrors src/lib/seo.ts's tenantCanonicalUrl: root path on a custom domain, `/r/<slug>` on the shared domain. */
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
    (path) => `  <url>\n    <loc>${xmlEscape(`${SITE_URL}${path}`)}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`,
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
    (path) => `  <url>\n    <loc>${xmlEscape(`${SITE_URL}${path}`)}</loc>\n    <changefreq>daily</changefreq>\n  </url>`,
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
  await writeFile(`dist/client/sitemaps/${tenant.slug}.xml`, xml, "utf8");
}

// --- sitemap index --------------------------------------------------------
function sitemapIndexEntry(tenant) {
  const origin = tenantOrigin(tenant);
  const loc = tenant.custom_domain ? `${origin}/sitemap.xml` : `${SITE_URL}/sitemaps/${tenant.slug}.xml`;
  const lastmod = lastmodOf(tenant);
  return ["  <sitemap>", `    <loc>${xmlEscape(loc)}</loc>`, lastmod ? `    <lastmod>${lastmod}</lastmod>` : null, "  </sitemap>"]
    .filter(Boolean)
    .join("\n");
}

// --- always-on static output (no Supabase needed) -------------------------
await mkdir("dist/client/sitemaps", { recursive: true });
await writeFile("dist/client/robots.txt", robotsLines.join("\n"), "utf8");
await writeFile("dist/client/sitemap-food.xml", staticMarketingSitemapXml(), "utf8");
await writeFile("dist/client/sitemap-marketplace.xml", staticMarketplaceSitemapXml(), "utf8");

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
    // ROOT_PAGE_TENANT_SLUG is already covered by STATIC_MARKETPLACE_PATHS's "/" entry.
    tenants = (data ?? []).filter((tenant) => tenant.slug !== ROOT_PAGE_TENANT_SLUG);
  }
}

const foodSitemapEntry = ["  <sitemap>", `    <loc>${xmlEscape(`${SITE_URL}/sitemap-food.xml`)}</loc>`, "  </sitemap>"].join("\n");
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
await writeFile("dist/client/sitemap.xml", indexXml, "utf8");

await Promise.all(tenants.map(writeTenantSitemap));

console.log(
  `[generate-seo-files] wrote dist/client/robots.txt, dist/client/sitemap.xml, dist/client/sitemap-food.xml, dist/client/sitemap-marketplace.xml, and ${tenants.length} tenant sitemap(s).`,
);
