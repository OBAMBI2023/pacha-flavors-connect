import { supabase } from "@/lib/supabase-any";

export type SeoSettings = {
  tagline: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  seo_og_image_url: string;
  google_site_verification: string;
  bing_site_verification: string;
  custom_domain: string;
};

const SEO_COLUMNS =
  "tagline,seo_title,seo_description,seo_keywords,seo_og_image_url,google_site_verification,bing_site_verification,custom_domain";

function toFormValue(v: string | null): string {
  return v ?? "";
}

/** Every restaurant already gets a restaurant_settings row at creation (DB-enforced), so this is always a plain select -- never an upsert. */
export async function fetchSeoSettings(restaurantId: string): Promise<SeoSettings> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select(SEO_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return {
    tagline: toFormValue(data?.tagline ?? null),
    seo_title: toFormValue(data?.seo_title ?? null),
    seo_description: toFormValue(data?.seo_description ?? null),
    seo_keywords: toFormValue(data?.seo_keywords ?? null),
    seo_og_image_url: toFormValue(data?.seo_og_image_url ?? null),
    google_site_verification: toFormValue(data?.google_site_verification ?? null),
    bing_site_verification: toFormValue(data?.bing_site_verification ?? null),
    custom_domain: toFormValue(data?.custom_domain ?? null),
  };
}

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Blank fields are saved as null (falls back to the auto-generated default), never as an empty string. */
export async function updateSeoSettings(restaurantId: string, values: SeoSettings): Promise<void> {
  const { error } = await supabase
    .from("restaurant_settings")
    .update({
      tagline: orNull(values.tagline),
      seo_title: orNull(values.seo_title),
      seo_description: orNull(values.seo_description),
      seo_keywords: orNull(values.seo_keywords),
      seo_og_image_url: orNull(values.seo_og_image_url),
      google_site_verification: orNull(values.google_site_verification),
      bing_site_verification: orNull(values.bing_site_verification),
      custom_domain: orNull(values.custom_domain),
    })
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
}
