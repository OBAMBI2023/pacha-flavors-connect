import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSeoSettings, updateSeoSettings, type SeoSettings } from "@/lib/seoSettings";
import { resolveSeoDescription, resolveSeoTitle, tenantCanonicalUrl } from "@/lib/seo";
import type { DbRestaurant } from "@/lib/menu-db";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * SEO configuration for this tenant's storefront. Every field here is an
 * *override* -- the SEO module (@/lib/seo) already auto-fills title,
 * description, keywords, and canonical URL from the restaurant's own
 * profile (name, address, city, logo) the moment the tenant is created, so
 * nothing here needs to be filled in for indexing to work. This card only
 * lets a tenant fine-tune what auto-fill already produces.
 *
 * Fields already editable elsewhere (name, logo, address, phone, city,
 * quartier, horaires) are intentionally not duplicated here -- they're
 * shown read-only as a preview of what the SEO module will use.
 */
export function SeoSettingsCard({ restaurantId, restaurant }: { restaurantId: string; restaurant: DbRestaurant | null }) {
  const [values, setValues] = useState<SeoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSeoSettings(restaurantId)
      .then((v) => {
        if (!cancelled) setValues(v);
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible de charger la configuration SEO."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  async function save() {
    if (!values) return;
    setBusy(true);
    try {
      await updateSeoSettings(restaurantId, values);
      toast.success("Configuration SEO mise à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer la configuration SEO.");
    } finally {
      setBusy(false);
    }
  }

  const previewRestaurant = restaurant
    ? {
        name: restaurant.name,
        slug: restaurant.slug,
        commune: restaurant.commune,
        city: restaurant.city,
        logo_url: restaurant.logo_url,
        cover_url: restaurant.cover_url,
      }
    : null;
  const previewSettings = values
    ? {
        description: null,
        tagline: values.tagline || null,
        seo_title: values.seo_title || null,
        seo_description: values.seo_description || null,
        seo_keywords: values.seo_keywords || null,
        seo_og_image_url: values.seo_og_image_url || null,
      }
    : null;
  const previewTitle = previewRestaurant && previewSettings ? resolveSeoTitle(previewRestaurant, previewSettings) : null;
  const previewDescription = previewRestaurant && previewSettings ? resolveSeoDescription(previewRestaurant, previewSettings) : null;
  const canonicalUrl = previewRestaurant && previewSettings ? tenantCanonicalUrl(previewRestaurant, previewSettings) : null;

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Search className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">SEO & Indexation</h2>
          <p className="text-sm text-muted-foreground">
            Optimisation automatique pour Google, Bing et les aperçus WhatsApp/Facebook/LinkedIn. Champs préremplis à
            partir du profil du restaurant -- personnalisez-les uniquement si besoin.
          </p>
        </div>
      </div>

      {loading || !values ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {canonicalUrl && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu résultat de recherche</p>
              <p className="mt-2 truncate text-xs text-emerald-700">{canonicalUrl}</p>
              <p className="mt-0.5 truncate text-base font-medium text-primary">{previewTitle}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{previewDescription}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titre SEO (facultatif)" hint={`Par défaut : "${previewTitle ?? ""}"`}>
              <Input
                value={values.seo_title}
                onChange={(e) => setValues((c) => (c ? { ...c, seo_title: e.target.value } : c))}
                placeholder={previewTitle ?? ""}
                maxLength={70}
                autoComplete="off"
              />
            </Field>
            <Field label="Slogan" hint="Court accroche affichée après le nom (ex. « Le meilleur tchep d'Abidjan »).">
              <Input
                value={values.tagline}
                onChange={(e) => setValues((c) => (c ? { ...c, tagline: e.target.value } : c))}
                autoComplete="off"
              />
            </Field>
          </div>

          <Field label="Description SEO (facultatif)" hint="Utilisée dans les résultats de recherche et les aperçus de partage. ~160 caractères recommandés.">
            <Textarea
              rows={3}
              maxLength={300}
              value={values.seo_description}
              onChange={(e) => setValues((c) => (c ? { ...c, seo_description: e.target.value } : c))}
              placeholder={previewDescription ?? ""}
              autoComplete="off"
            />
          </Field>

          <Field label="Mots-clés" hint="Séparés par des virgules. Optionnel -- généré automatiquement sinon.">
            <Input
              value={values.seo_keywords}
              onChange={(e) => setValues((c) => (c ? { ...c, seo_keywords: e.target.value } : c))}
              placeholder="restaurant, livraison, nom du plat..."
              autoComplete="off"
            />
          </Field>

          <Field
            label="Image SEO / réseaux sociaux"
            hint="URL affichée dans les aperçus WhatsApp/Facebook/LinkedIn. Utilise le logo ou la photo de couverture si vide."
          >
            <Input
              value={values.seo_og_image_url}
              onChange={(e) => setValues((c) => (c ? { ...c, seo_og_image_url: e.target.value } : c))}
              placeholder="https://..."
              autoComplete="off"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Google Search Console" hint="Balise de vérification (meta name=&quot;google-site-verification&quot;).">
              <Input
                value={values.google_site_verification}
                onChange={(e) => setValues((c) => (c ? { ...c, google_site_verification: e.target.value } : c))}
                placeholder="Code fourni par Google Search Console"
                autoComplete="off"
              />
            </Field>
            <Field label="Bing Webmaster Tools" hint="Balise de vérification (meta name=&quot;msvalidate.01&quot;).">
              <Input
                value={values.bing_site_verification}
                onChange={(e) => setValues((c) => (c ? { ...c, bing_site_verification: e.target.value } : c))}
                placeholder="Code fourni par Bing Webmaster Tools"
                autoComplete="off"
              />
            </Field>
          </div>

          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Enregistrement..." : "Enregistrer la configuration SEO"}
          </Button>
        </>
      )}
    </Card>
  );
}
