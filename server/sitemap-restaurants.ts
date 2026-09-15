import { defineHandler } from "nitro";
import { createClient } from "@supabase/supabase-js";

/**
 * Dynamic, request-time sub-sitemap listing every public, active, non-test
 * tenant storefront -- the one part of the old build-time sitemap
 * (scripts/generate-seo-files.mjs) that genuinely needs to change between
 * deploys, since restaurants get published/suspended at arbitrary times.
 *
 * Registered at /sitemap-restaurants.xml via vite.config.ts's
 * `nitro({ routes })` -- a programmatic Nitro route, not filesystem-scanned
 * (this project's Nitro/Vite integration has route-directory scanning
 * disabled by default and nothing here turns it on) -- and deliberately a
 * path public/ has never served a static file at, so there is no ambiguity
 * with Vercel's static-asset routing for this exact URL: this handler is the
 * only thing that can ever answer it.
 *
 * Reuses get_public_sitemap_index() unchanged (see
 * supabase/migrations/20260828740000_seo_infrastructure.sql and
 * supabase/migrations/20260914200000_seo_test_restaurant_exclusion.sql) --
 * the exact same is_public = true, status = 'active', is_test = false rule
 * the old build-time script used, and the same one src/routes/r.$slug.tsx's
 * storefront itself is scoped by. No second, competing eligibility rule.
 *
 * sitemap.xml itself (scripts/generate-seo-files.mjs) stays a plain static
 * file that references this URL by a fixed path -- it never needs
 * regenerating when a tenant's status changes, only this file's *content*
 * does, live.
 */

const SITE_URL = (process.env["VITE_SITE_URL"] || "https://food.saovia.net").replace(/\/+$/, "");
const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
const SUPABASE_KEY =
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];

// The sitemap protocol caps a single <urlset> at 50,000 <url> entries. At
// today's tenant count (a few dozen) this can never trigger -- once it can,
// the real fix is paginating into sitemap-restaurants-N.xml pages (which
// would also make sitemap.xml itself dynamic, to list however many pages
// currently exist), not raising this number or silently emitting an
// oversized file.
const MAX_URLS_PER_SITEMAP = 50_000;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Only the columns get_public_sitemap_index() actually returns -- never orders, customers, contact details, or any other Admin/private data. */
type SitemapTenant = {
  slug: string;
  name: string | null;
  custom_domain: string | null;
  updated_at: string | null;
};

/**
 * Mirrors src/lib/seo.ts's tenantCanonicalUrl exactly: root path on a custom
 * domain, `/r/<slug>` on the shared domain otherwise. No current tenant has
 * custom_domain set (still an unwired architecture placeholder -- see
 * supabase/migrations/20260828740000_seo_infrastructure.sql), so this branch
 * is dormant today but must stay correct for when one does: listing `/r/
 * <slug>` for a custom-domain tenant would contradict that tenant's own
 * canonical link tag and create a duplicate-content signal.
 */
function tenantCanonicalUrl(tenant: SitemapTenant): string {
  if (tenant.custom_domain) {
    const origin = tenant.custom_domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${origin}/`;
  }
  return `${SITE_URL}/r/${tenant.slug}`;
}

function lastmodOf(tenant: SitemapTenant): string | null {
  if (!tenant.updated_at) return null;
  const date = new Date(tenant.updated_at);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function tenantsSitemapXml(tenants: SitemapTenant[]): string {
  const entries = tenants.slice(0, MAX_URLS_PER_SITEMAP).map((tenant) => {
    const lastmod = lastmodOf(tenant);
    return [
      "  <url>",
      `    <loc>${xmlEscape(tenantCanonicalUrl(tenant))}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      "    <changefreq>daily</changefreq>",
      "  </url>",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}

export default defineHandler(async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // Never fail the request over missing config -- an empty but valid
    // urlset is safer for a public, Googlebot-facing endpoint than a 500,
    // and this mirrors the old build script's own "degrade gracefully
    // without Supabase" behavior (e.g. local dev with no env configured).
    console.error(
      "[sitemap-restaurants] Missing Supabase env vars -- serving an empty urlset instead of failing the request.",
    );
    return new Response(tenantsSitemapXml([]), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=30",
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.rpc("get_public_sitemap_index");

  if (error) {
    // A transient Supabase hiccup should never surface as a 500 to
    // Googlebot -- that can make a crawler back off the whole sitemap. Serve
    // a valid, empty-for-now urlset and let the next (short) cache window
    // retry against Supabase.
    console.error("[sitemap-restaurants] get_public_sitemap_index failed:", error.message);
    return new Response(tenantsSitemapXml([]), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=30",
      },
    });
  }

  const tenants = (data ?? []) as SitemapTenant[];
  if (tenants.length > MAX_URLS_PER_SITEMAP) {
    console.warn(
      `[sitemap-restaurants] ${tenants.length} eligible tenants exceeds the ${MAX_URLS_PER_SITEMAP}-URL sitemap protocol limit -- truncating this response. Paginate into sitemap-restaurants-N.xml before this ever happens for real.`,
    );
  }

  return new Response(tenantsSitemapXml(tenants), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Fresh at Vercel's edge for 10 minutes, then served stale for up to a
      // day while revalidating in the background: a tenant a Super Admin
      // just published or suspended is reflected here within that window --
      // no git push, no redeploy -- while Googlebot's actual crawl cadence
      // (hours to days) never notices the difference. Lower s-maxage for
      // faster propagation if ever needed; there's no correctness reason it
      // can't go lower.
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    },
  });
});
