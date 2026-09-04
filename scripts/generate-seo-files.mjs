// Generates dist/client/robots.txt, dist/client/sitemap.xml (a sitemap
// index), and one dist/client/sitemaps/<slug>.xml per public tenant, after
// `vite build` -- automatic on every deploy, no manual step, always
// reflecting whichever tenants are currently public+active.
//
// This TanStack Start version (see vite.config.ts / generate-sw.mjs) has no
// dynamic API-route support, so a true per-request /sitemap.xml handler
// isn't available from application code. Static files regenerated on every
// build is the closest safe equivalent -- same reasoning, same postbuild
// pattern already used for the PWA service worker.
//
// Reads only via get_public_sitemap_index, the same security-definer,
// tenant-scoped (is_public = true, status = 'active') RPC family the
// storefront itself uses -- never touches orders, customers, or Admin data,
// and the anon/publishable key is all this needs (no service role).
//
// Keep the canonical-URL logic below in sync with src/lib/seo.ts's
// tenantCanonicalUrl -- duplicated here only because this plain Node script
// (run directly, not through Vite/tsx) can't resolve the app's `@/` path
// aliases or import .ts source.
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SITE_URL = (process.env.VITE_SITE_URL || "https://saoviafood.com").replace(/\/+$/, "");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("[generate-seo-files] Missing Supabase env vars -- skipping sitemap/robots generation.");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data, error } = await supabase.rpc("get_public_sitemap_index");
if (error) {
  console.warn("[generate-seo-files] Public sitemap index unavailable; generating an empty index.");
}

const tenants = data ?? [];

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

await mkdir("dist/client/sitemaps", { recursive: true });
await writeFile("dist/client/robots.txt", robotsLines.join("\n"), "utf8");

const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${tenants
  .map(sitemapIndexEntry)
  .join("\n")}\n</sitemapindex>\n`;
await writeFile("dist/client/sitemap.xml", indexXml, "utf8");

await Promise.all(tenants.map(writeTenantSitemap));

console.log(
  `[generate-seo-files] wrote dist/client/robots.txt, dist/client/sitemap.xml, and ${tenants.length} tenant sitemap(s).`,
);
