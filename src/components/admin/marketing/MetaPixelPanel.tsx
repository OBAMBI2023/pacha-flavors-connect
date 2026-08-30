import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PencilLine, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  fetchMetaPixelSettings,
  isValidMetaPixelId,
  maskMetaPixelId,
  normalizeMetaPixelId,
  testMetaPixelId,
  updateMetaPixelSettings,
  type MetaPixelSettings,
} from "@/lib/metaPixel";

const TRACKED_EVENTS = [
  { name: "PageView", trigger: "Visite d'une page du site vitrine" },
  { name: "ViewContent", trigger: "Consultation d'un plat" },
  { name: "AddToCart", trigger: "Ajout d'un plat au panier" },
  { name: "InitiateCheckout", trigger: "Début du paiement" },
  { name: "Purchase", trigger: "Commande finalisée" },
];

export function MetaPixelPanel({ restaurantId }: { restaurantId: string }) {
  const [settings, setSettings] = useState<MetaPixelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editingId, setEditingId] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pixelIdInput, setPixelIdInput] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const data = await fetchMetaPixelSettings(restaurantId);
      setSettings(data);
      setEnabled(data.meta_pixel_enabled);
      setPixelIdInput(data.meta_pixel_id ?? "");
      setEditingId(!data.meta_pixel_id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger la configuration Meta Pixel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function save() {
    const trimmed = normalizeMetaPixelId(pixelIdInput);
    if (enabled && !trimmed) {
      toast.error("Indiquez l'ID du Meta Pixel avant d'activer le suivi.");
      return;
    }
    if (trimmed && !isValidMetaPixelId(trimmed)) {
      toast.error("L'identifiant du Pixel doit contenir uniquement des chiffres (9 à 20 caractères).");
      return;
    }
    setSaving(true);
    try {
      await updateMetaPixelSettings(restaurantId, { meta_pixel_id: trimmed || null, meta_pixel_enabled: enabled });
      toast.success("Configuration Meta Pixel enregistrée.");
      setEditingId(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer la configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    const trimmed = normalizeMetaPixelId(pixelIdInput);
    setTesting(true);
    try {
      await testMetaPixelId(trimmed);
      toast.success("Le Pixel a répondu correctement. Vérifiez l'événement dans le Gestionnaire d'événements Meta.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Le test du Pixel a échoué.");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <Card className="p-6 text-sm text-muted-foreground">Chargement...</Card>;
  }

  const isActive = Boolean(settings?.meta_pixel_enabled && settings.meta_pixel_id);

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Meta Pixel</h3>
            <p className="mt-1 text-sm text-muted-foreground">Mesurez les visites et conversions provenant de vos campagnes Meta.</p>
          </div>
          <Badge className={isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}>
            {isActive ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
            {isActive ? "Actif" : "Inactif"}
          </Badge>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Activer Meta Pixel</p>
            <p className="text-xs text-muted-foreground">Charge le Pixel uniquement sur votre site vitrine, jamais ailleurs.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
        </div>

        <div className="space-y-1.5">
          <Label>ID du Meta Pixel</Label>
          {editingId ? (
            <Input
              value={pixelIdInput}
              onChange={(e) => setPixelIdInput(e.target.value)}
              placeholder="Ex. 123456789012345"
              inputMode="numeric"
            />
          ) : (
            <div className="flex items-center gap-2">
              <Input value={settings?.meta_pixel_id ? maskMetaPixelId(settings.meta_pixel_id) : ""} readOnly disabled className="bg-muted/40" />
              <Button type="button" variant="outline" size="icon" onClick={() => setEditingId(true)} aria-label="Modifier l'ID du Pixel">
                <PencilLine className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Identifiant numérique fourni par le Gestionnaire d'événements Meta -- il n'est pas confidentiel, mais reste propre à votre restaurant.</p>
        </div>

        {settings?.meta_pixel_id && (
          <p className="text-xs text-muted-foreground">Dernière modification : {new Date(settings.updated_at).toLocaleString("fr-FR")}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void test()}
            disabled={testing || !normalizeMetaPixelId(pixelIdInput)}
          >
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Tester le Pixel
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">Événements suivis</h3>
        <ul className="mt-3 space-y-2">
          {TRACKED_EVENTS.map((event) => (
            <li key={event.name} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{event.name}</span>
              <span className="text-xs text-muted-foreground">{event.trigger}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
