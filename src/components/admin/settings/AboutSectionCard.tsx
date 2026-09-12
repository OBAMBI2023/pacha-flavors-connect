import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AboutHighlight, AboutSection, DbRestaurant } from "@/lib/menu-db";
import {
  ABOUT_SECTION_MAX_HIGHLIGHTS,
  fetchAboutSection,
  updateAboutSection,
  uploadAboutImage,
} from "@/lib/restaurantSettings";
import { ABOUT_HIGHLIGHT_ICON_NAMES, DEFAULT_ABOUT_HIGHLIGHT_ICON } from "@/lib/aboutSectionIcons";
import { TenantAboutSection } from "@/components/tenant/TenantAboutSection";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Starting values only -- an admin seeing this form for the very first time
 * (fetchAboutSection returned `{}`, meaning restaurant_settings.about_section
 * is still at its column default) gets these pre-filled so the form isn't a
 * wall of empty inputs, exactly like a blank document template. Nothing
 * here ever reaches the public storefront on its own: TenantAboutSection
 * only ever renders what was actually saved, and the tenant is free to
 * edit, clear, or replace every one of these values before saving.
 */
const STARTER_ABOUT_SECTION: AboutSection = {
  enabled: true,
  eyebrow: "NOTRE HISTOIRE",
  title: "",
  description: "",
  secondary_description: "",
  signature: "",
  cta_label: "Découvrir notre menu",
  chef_name: "",
  chef_role: "",
  chef_message: "",
  main_image_url: null,
  highlights: [
    { icon: "Leaf", title: "Ingrédients frais", description: "Sélectionnés chaque jour" },
    { icon: "ChefHat", title: "Recettes maison", description: "Préparées avec passion" },
    { icon: "Flame", title: "Cuisson parfaite", description: "Un savoir-faire authentique" },
    { icon: "Timer", title: "Service rapide", description: "Commande simple et rapide" },
  ],
};

function emptyHighlight(): AboutHighlight {
  return { icon: DEFAULT_ABOUT_HIGHLIGHT_ICON, title: "", description: "" };
}

function CharCount({ value, max }: { value: string | undefined; max: number }) {
  return (
    <p className="text-right text-xs text-muted-foreground">
      {(value ?? "").length} / {max}
    </p>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const PREVIEW_DEVICES = [
  { id: "mobile" as const, label: "Mobile" },
  { id: "tablet" as const, label: "Tablette" },
  { id: "desktop" as const, label: "Desktop" },
];

export function AboutSectionCard({
  restaurantId,
  restaurant,
}: {
  restaurantId: string | null;
  restaurant: DbRestaurant | null;
}) {
  const [form, setForm] = useState<AboutSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setLoading(true);
    fetchAboutSection(restaurantId)
      .then((fetched) => {
        if (cancelled) return;
        const isFirstTime = Object.keys(fetched).length === 0;
        setForm(isFirstTime ? STARTER_ABOUT_SECTION : { highlights: [], ...fetched });
      })
      .catch((err: unknown) =>
        toast.error(
          err instanceof Error ? err.message : "Impossible de charger « Notre histoire ».",
        ),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  function update<K extends keyof AboutSection>(key: K, value: AboutSection[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateHighlight(index: number, patch: Partial<AboutHighlight>) {
    setForm((current) => {
      if (!current) return current;
      const highlights = [...(current.highlights ?? [])];
      const existing = highlights[index] ?? emptyHighlight();
      highlights[index] = { ...existing, ...patch } as AboutHighlight;
      return { ...current, highlights };
    });
  }

  function addHighlight() {
    setForm((current) => {
      if (!current) return current;
      const highlights = current.highlights ?? [];
      if (highlights.length >= ABOUT_SECTION_MAX_HIGHLIGHTS) return current;
      return { ...current, highlights: [...highlights, emptyHighlight()] };
    });
  }

  function removeHighlight(index: number) {
    setForm((current) => {
      if (!current) return current;
      const highlights = [...(current.highlights ?? [])];
      highlights.splice(index, 1);
      return { ...current, highlights };
    });
  }

  async function handleImagePick(file: File) {
    if (!restaurantId) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Format d'image non supporté.", {
        description: "Utilisez un fichier JPG, PNG ou WEBP.",
      });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error("Image trop volumineuse.", { description: "La photo doit peser moins de 5 MB." });
      return;
    }
    setUploadingImage(true);
    try {
      const url = await uploadAboutImage(restaurantId, file);
      update("main_image_url", url);
      toast.success("Photo mise à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'envoyer la photo.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function save() {
    if (!restaurantId || !form) return;
    if (!form.title?.trim() || !form.description?.trim()) {
      toast.error("Le titre principal et le texte « Notre histoire » sont requis.");
      return;
    }
    setSaving(true);
    try {
      await updateAboutSection(restaurantId, form);
      toast.success("Votre section « Notre histoire » a été mise à jour.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d'enregistrer « Notre histoire ».",
      );
    } finally {
      setSaving(false);
    }
  }

  const previewRestaurant = restaurant
    ? { name: restaurant.name, logo_url: restaurant.logo_url, cover_url: restaurant.cover_url }
    : { name: "Restaurant", logo_url: null, cover_url: null };
  const highlights = form?.highlights ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="space-y-6 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold">Notre histoire</h2>
            <p className="text-sm text-muted-foreground">
              Présentez l'histoire, les valeurs et l'identité de votre restaurant.
            </p>
          </div>
        </div>

        {loading || !form ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3">
              <Switch
                checked={form.enabled ?? true}
                onCheckedChange={(v) => update("enabled", v)}
              />
              <div>
                <p className="text-sm font-medium">Afficher « Notre histoire »</p>
                <p className="text-xs text-muted-foreground">
                  Désactivé, la section n'apparaît plus du tout sur votre site.
                </p>
              </div>
            </div>

            {/* Présentation */}
            <div className="space-y-4">
              <SectionHeading title="Présentation" />
              <div className="space-y-1.5">
                <Label>Petit titre</Label>
                <Input
                  value={form.eyebrow ?? ""}
                  onChange={(e) => update("eyebrow", e.target.value)}
                  maxLength={40}
                  placeholder="NOTRE HISTOIRE"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Titre principal *</Label>
                <Input
                  value={form.title ?? ""}
                  onChange={(e) => update("title", e.target.value)}
                  maxLength={100}
                  placeholder="Une ville, mille saveurs."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notre histoire *</Label>
                <Textarea
                  rows={5}
                  value={form.description ?? ""}
                  onChange={(e) => update("description", e.target.value)}
                  maxLength={1000}
                  placeholder="Présentez l'histoire de votre restaurant..."
                />
                <CharCount value={form.description} max={1000} />
              </div>
              <div className="space-y-1.5">
                <Label>Complément</Label>
                <Textarea
                  rows={3}
                  value={form.secondary_description ?? ""}
                  onChange={(e) => update("secondary_description", e.target.value)}
                  maxLength={500}
                  placeholder="Partagez votre savoir-faire, vos valeurs ou votre philosophie..."
                />
                <CharCount value={form.secondary_description} max={500} />
              </div>
            </div>

            {/* Portrait / équipe */}
            <div className="space-y-4 border-t border-border pt-5">
              <SectionHeading
                title="Portrait / équipe"
                hint="Photo de la cheffe, du fondateur, de l'équipe ou du restaurant. Recommandé : ratio 4:5, haute qualité."
              />
              <div className="space-y-2">
                <Label>Photo principale</Label>
                <div className="rounded-2xl border border-dashed border-border p-4">
                  <div className="mx-auto mb-3 aspect-[4/5] w-40 overflow-hidden rounded-2xl bg-muted">
                    {form.main_image_url && (
                      <img
                        src={form.main_image_url}
                        alt="Aperçu"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(",")}
                      disabled={uploadingImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImagePick(file);
                        e.target.value = "";
                      }}
                    />
                    {form.main_image_url && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        onClick={() => update("main_image_url", null)}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" /> Retirer
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    JPG, JPEG, PNG ou WEBP · max 5 MB. Sans photo, la couverture ou le logo du
                    restaurant est utilisé.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nom / fonction</Label>
                  <Input
                    value={form.chef_name ?? ""}
                    onChange={(e) => update("chef_name", e.target.value)}
                    maxLength={100}
                    placeholder="Ex. La Cheffe Mariam"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fonction</Label>
                  <Input
                    value={form.chef_role ?? ""}
                    onChange={(e) => update("chef_role", e.target.value)}
                    maxLength={100}
                    placeholder="Ex. Fondatrice & Cheffe"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Message personnel</Label>
                <Textarea
                  rows={3}
                  value={form.chef_message ?? ""}
                  onChange={(e) => update("chef_message", e.target.value)}
                  maxLength={500}
                  placeholder="Un court message de la cheffe ou du fondateur..."
                />
                <CharCount value={form.chef_message} max={500} />
              </div>
            </div>

            {/* Points forts */}
            <div className="space-y-4 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-3">
                <SectionHeading
                  title="Points forts"
                  hint={`${highlights.length} / ${ABOUT_SECTION_MAX_HIGHLIGHTS} maximum`}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addHighlight}
                  disabled={highlights.length >= ABOUT_SECTION_MAX_HIGHLIGHTS}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter
                </Button>
              </div>
              {highlights.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun point fort. Ajoutez-en jusqu'à {ABOUT_SECTION_MAX_HIGHLIGHTS}.
                </p>
              ) : (
                <div className="space-y-3">
                  {highlights.map((highlight, index) => (
                    <div key={index} className="space-y-3 rounded-2xl border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Point fort {index + 1}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeHighlight(index)}
                          aria-label="Supprimer ce point fort"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Icône</Label>
                          <Select
                            value={highlight.icon || DEFAULT_ABOUT_HIGHLIGHT_ICON}
                            onValueChange={(v) => updateHighlight(index, { icon: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ABOUT_HIGHLIGHT_ICON_NAMES.map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Titre</Label>
                          <Input
                            value={highlight.title}
                            onChange={(e) => updateHighlight(index, { title: e.target.value })}
                            maxLength={60}
                            placeholder="Ex. Ingrédients frais"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={highlight.description}
                          onChange={(e) => updateHighlight(index, { description: e.target.value })}
                          maxLength={80}
                          placeholder="Ex. Sélectionnés chaque jour"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action */}
            <div className="space-y-4 border-t border-border pt-5">
              <SectionHeading title="Action" />
              <div className="space-y-1.5">
                <Label>Signature</Label>
                <Input
                  value={form.signature ?? ""}
                  onChange={(e) => update("signature", e.target.value)}
                  maxLength={100}
                  placeholder="Le nom de votre restaurant"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bouton</Label>
                <Input
                  value={form.cta_label ?? ""}
                  onChange={(e) => update("cta_label", e.target.value)}
                  maxLength={40}
                  placeholder="Découvrir notre menu"
                />
              </div>
            </div>

            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Aperçu</h3>
          <div className="inline-flex rounded-full border border-border bg-muted p-1">
            {PREVIEW_DEVICES.map((device) => (
              <button
                key={device.id}
                type="button"
                onClick={() => setPreviewDevice(device.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  previewDevice === device.id ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                {device.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-white">
          <div
            className="mx-auto overflow-hidden pointer-events-none"
            style={{
              width: previewDevice === "mobile" ? 375 : previewDevice === "tablet" ? 640 : "100%",
              maxWidth: "100%",
            }}
          >
            {form && (form.title?.trim() ?? "") && (form.description?.trim() ?? "") ? (
              <TenantAboutSection
                restaurant={previewRestaurant}
                about={{ ...form, enabled: true }}
                previewLayout={previewDevice === "mobile" ? "mobile" : "wide"}
              />
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Renseignez au moins le titre principal et « Notre histoire » pour voir l'aperçu.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
