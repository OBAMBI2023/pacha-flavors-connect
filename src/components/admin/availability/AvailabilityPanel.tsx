import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AvailabilityBadge } from "@/components/tenant/AvailabilityBadge";
import {
  DAY_DISPLAY_ORDER,
  DAY_LABELS,
  createBusinessException,
  createBusinessHoursSlot,
  deleteBusinessException,
  deleteBusinessHoursSlot,
  fetchAvailability,
  fetchBusinessExceptions,
  fetchBusinessHours,
  fetchManualOverride,
  setManualOverride,
  updateBusinessException,
  updateBusinessHoursSlot,
  type BusinessException,
  type BusinessExceptionInput,
  type BusinessHoursSlot,
  type DayOfWeek,
  type ManualOverrideMode,
  type RestaurantAvailability,
} from "@/lib/businessHours";

const OVERRIDE_LABELS: Record<ManualOverrideMode, string> = { automatic: "Automatique", open: "Ouvert", closed: "Fermé" };

function reasonLabel(a: RestaurantAvailability | null): string {
  if (!a) return "";
  switch (a.reason) {
    case "exception":
      return "Une exception est active pour aujourd'hui.";
    case "manual":
      return "Statut forcé manuellement.";
    case "schedule":
      return "Calculé selon le planning hebdomadaire.";
    case "unconfigured":
      return "Aucun horaire configuré — ouvert par défaut.";
    default:
      return "";
  }
}

function emptyExceptionForm(): BusinessExceptionInput {
  const today = new Date().toISOString().slice(0, 10);
  return { date: today, end_date: null, is_open: false, opening_time: null, closing_time: null, reason: "" };
}

export function AvailabilityPanel({ restaurantId, timezone }: { restaurantId: string; timezone: string }) {
  const [hours, setHours] = useState<BusinessHoursSlot[]>([]);
  const [exceptions, setExceptions] = useState<BusinessException[]>([]);
  const [overrideMode, setOverrideMode] = useState<ManualOverrideMode>("automatic");
  const [availability, setAvailability] = useState<RestaurantAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [editingException, setEditingException] = useState<BusinessException | null>(null);
  const [exceptionForm, setExceptionForm] = useState<BusinessExceptionInput>(() => emptyExceptionForm());
  const [exceptionDeleteTarget, setExceptionDeleteTarget] = useState<BusinessException | null>(null);

  // Local draft of the time-slot inputs, keyed by slot id. Typing only edits
  // this draft — it is never written to Supabase until "Enregistrer les
  // horaires" is clicked, and background refetches never replace the whole
  // panel with a loading skeleton (that used to remount every input on each
  // keystroke and drop focus/scroll).
  const [hoursDraft, setHoursDraft] = useState<Record<string, { opening_time: string; closing_time: string }>>({});
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    setHoursDraft(
      Object.fromEntries(
        hours.map((slot) => [slot.id, { opening_time: (slot.opening_time ?? "").slice(0, 5), closing_time: (slot.closing_time ?? "").slice(0, 5) }]),
      ),
    );
  }, [hours]);

  async function loadAll() {
    setLoading(true);
    try {
      const [h, e, o, a] = await Promise.all([
        fetchBusinessHours(restaurantId),
        fetchBusinessExceptions(restaurantId),
        fetchManualOverride(restaurantId),
        fetchAvailability(restaurantId),
      ]);
      setHours(h);
      setExceptions(e);
      setOverrideMode(o);
      setAvailability(a);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger la disponibilité.");
    } finally {
      setLoading(false);
    }
  }

  // Same fetch as loadAll, but never toggles `loading` — used after a
  // mutation so the panel updates in place instead of being replaced by the
  // "Chargement..." skeleton (which was unmounting the whole form).
  async function reloadSilently() {
    try {
      const [h, e, o, a] = await Promise.all([
        fetchBusinessHours(restaurantId),
        fetchBusinessExceptions(restaurantId),
        fetchManualOverride(restaurantId),
        fetchAvailability(restaurantId),
      ]);
      setHours(h);
      setExceptions(e);
      setOverrideMode(o);
      setAvailability(a);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de recharger la disponibilité.");
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function refreshAvailabilityOnly() {
    try {
      setAvailability(await fetchAvailability(restaurantId));
    } catch {
      // non-fatal: preview just won't update
    }
  }

  async function handleSetOverride(mode: ManualOverrideMode) {
    setBusy(true);
    try {
      await setManualOverride(restaurantId, mode);
      setOverrideMode(mode);
      toast.success("Statut mis à jour");
      await refreshAvailabilityOnly();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour le statut.");
    } finally {
      setBusy(false);
    }
  }

  const hoursByDay = new Map<DayOfWeek, BusinessHoursSlot[]>();
  for (const day of DAY_DISPLAY_ORDER) hoursByDay.set(day, []);
  for (const slot of hours) hoursByDay.get(slot.day_of_week)?.push(slot);

  async function toggleDayOpen(day: DayOfWeek, nextOpen: boolean) {
    const daySlots = hoursByDay.get(day) ?? [];
    setBusy(true);
    try {
      if (nextOpen && daySlots.length === 0) {
        await createBusinessHoursSlot(restaurantId, { day_of_week: day, is_open: true, opening_time: "09:00", closing_time: "18:00" });
      } else {
        await Promise.all(
          daySlots.map((slot) =>
            updateBusinessHoursSlot(slot.id, {
              day_of_week: slot.day_of_week,
              is_open: nextOpen,
              opening_time: nextOpen ? (slot.opening_time ?? "09:00:00") : null,
              closing_time: nextOpen ? (slot.closing_time ?? "18:00:00") : null,
            }),
          ),
        );
      }
      await reloadSilently();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour ce jour.");
    } finally {
      setBusy(false);
    }
  }

  async function addSlot(day: DayOfWeek) {
    setBusy(true);
    try {
      await createBusinessHoursSlot(restaurantId, { day_of_week: day, is_open: true, opening_time: "09:00", closing_time: "18:00" });
      await reloadSilently();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'ajouter ce créneau (chevauche peut-être un créneau existant).");
    } finally {
      setBusy(false);
    }
  }

  function setSlotDraftTime(slotId: string, field: "opening_time" | "closing_time", value: string) {
    setHoursDraft((current) => ({
      ...current,
      [slotId]: { opening_time: current[slotId]?.opening_time ?? "", closing_time: current[slotId]?.closing_time ?? "", [field]: value },
    }));
  }

  const hoursDirty = hours.some((slot) => {
    const draft = hoursDraft[slot.id];
    if (!draft) return false;
    return draft.opening_time !== (slot.opening_time ?? "").slice(0, 5) || draft.closing_time !== (slot.closing_time ?? "").slice(0, 5);
  });

  async function saveHours() {
    const changed = hours.flatMap((slot) => {
      const draft = hoursDraft[slot.id];
      if (!draft) return [];
      if (draft.opening_time === (slot.opening_time ?? "").slice(0, 5) && draft.closing_time === (slot.closing_time ?? "").slice(0, 5)) return [];
      return [{ slot, draft }];
    });
    if (changed.length === 0) return;

    setSavingHours(true);
    try {
      await Promise.all(
        changed.map(({ slot, draft }) =>
          updateBusinessHoursSlot(slot.id, {
            day_of_week: slot.day_of_week,
            is_open: slot.is_open,
            opening_time: draft.opening_time || null,
            closing_time: draft.closing_time || null,
          }),
        ),
      );
      toast.success("Horaires enregistrés");
      await reloadSilently();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer les horaires.");
    } finally {
      setSavingHours(false);
    }
  }

  async function removeSlot(slot: BusinessHoursSlot) {
    setBusy(true);
    try {
      await deleteBusinessHoursSlot(slot.id);
      await reloadSilently();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer ce créneau.");
    } finally {
      setBusy(false);
    }
  }

  function openCreateException() {
    setEditingException(null);
    setExceptionForm(emptyExceptionForm());
    setExceptionDialogOpen(true);
  }

  function openEditException(exception: BusinessException) {
    setEditingException(exception);
    setExceptionForm({
      date: exception.date,
      end_date: exception.end_date,
      is_open: exception.is_open,
      opening_time: exception.opening_time,
      closing_time: exception.closing_time,
      reason: exception.reason ?? "",
    });
    setExceptionDialogOpen(true);
  }

  async function saveException() {
    if (!exceptionForm.date) {
      toast.error("La date est requise.");
      return;
    }
    if (exceptionForm.end_date && exceptionForm.end_date < exceptionForm.date) {
      toast.error("La date de fin doit être après la date de début.");
      return;
    }
    if (exceptionForm.is_open && (!exceptionForm.opening_time || !exceptionForm.closing_time)) {
      toast.error("Indiquez une heure d'ouverture et de fermeture pour une ouverture exceptionnelle.");
      return;
    }

    setBusy(true);
    try {
      const payload: BusinessExceptionInput = {
        ...exceptionForm,
        end_date: exceptionForm.end_date || null,
        opening_time: exceptionForm.is_open ? exceptionForm.opening_time : null,
        closing_time: exceptionForm.is_open ? exceptionForm.closing_time : null,
        reason: exceptionForm.reason?.trim() || null,
      };
      if (editingException) await updateBusinessException(editingException.id, payload);
      else await createBusinessException(restaurantId, payload);
      toast.success(editingException ? "Exception mise à jour" : "Exception ajoutée");
      setExceptionDialogOpen(false);
      await reloadSilently();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer l'exception.");
    } finally {
      setBusy(false);
    }
  }

  async function removeException() {
    if (!exceptionDeleteTarget) return;
    setBusy(true);
    try {
      await deleteBusinessException(exceptionDeleteTarget.id);
      toast.success("Exception supprimée");
      setExceptionDeleteTarget(null);
      await reloadSilently();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer l'exception.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Card className="p-6 text-sm text-muted-foreground">Chargement...</Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Disponibilité du restaurant</h2>
        <p className="text-sm text-muted-foreground">Horaires, exceptions et statut d'ouverture, calculés selon le fuseau horaire du restaurant ({timezone}).</p>
      </div>

      {/* Statut actuel */}
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Statut actuel</h3>
        <AvailabilityBadge availability={availability} timezone={timezone} />
        <p className="text-xs text-muted-foreground">{reasonLabel(availability)}</p>

        <div className="space-y-2 border-t border-border pt-4">
          <Label>Forcer manuellement le statut</Label>
          <div className="flex flex-wrap gap-2">
            {(["automatic", "open", "closed"] as ManualOverrideMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={busy}
                onClick={() => void handleSetOverride(mode)}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  overrideMode === mode ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
                }`}
              >
                {OVERRIDE_LABELS[mode]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">En mode Automatique, le statut est calculé à partir du planning hebdomadaire et des exceptions.</p>
        </div>
      </Card>

      {/* Horaires de la semaine */}
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Horaires de la semaine</h3>
        <div className="space-y-4">
          {DAY_DISPLAY_ORDER.map((day) => {
            const slots = hoursByDay.get(day) ?? [];
            const dayOpen = slots.some((s) => s.is_open);
            return (
              <div key={day} className="rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{DAY_LABELS[day]}</span>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch checked={dayOpen} disabled={busy} onCheckedChange={(v) => void toggleDayOpen(day, v)} /> {dayOpen ? "Ouvert" : "Fermé"}
                  </label>
                </div>
                {dayOpen && (
                  <div className="mt-3 space-y-2">
                    {slots.filter((s) => s.is_open).map((slot) => (
                      <div key={slot.id} className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          value={hoursDraft[slot.id]?.opening_time ?? (slot.opening_time ?? "").slice(0, 5)}
                          onChange={(e) => setSlotDraftTime(slot.id, "opening_time", e.target.value)}
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">→</span>
                        <Input
                          type="time"
                          value={hoursDraft[slot.id]?.closing_time ?? (slot.closing_time ?? "").slice(0, 5)}
                          onChange={(e) => setSlotDraftTime(slot.id, "closing_time", e.target.value)}
                          className="w-32"
                        />
                        <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={() => void removeSlot(slot)} aria-label="Supprimer ce créneau">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void addSlot(day)}>
                      <Plus className="mr-2 h-3.5 w-3.5" /> Ajouter un créneau
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          {hoursDirty && !savingHours && <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>}
          <Button type="button" onClick={() => void saveHours()} disabled={!hoursDirty || savingHours || busy}>
            {savingHours ? "Enregistrement..." : "Enregistrer les horaires"}
          </Button>
        </div>
      </Card>

      {/* Exceptions */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Disponibilités exceptionnelles</h3>
          <Button type="button" size="sm" onClick={openCreateException} disabled={busy}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter une exception
          </Button>
        </div>
        {exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune exception pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {exceptions.map((exception) => (
              <div key={exception.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
                <div>
                  <p className="font-medium">
                    {new Date(exception.date + "T00:00:00").toLocaleDateString("fr-FR")}
                    {exception.end_date && exception.end_date !== exception.date ? ` → ${new Date(exception.end_date + "T00:00:00").toLocaleDateString("fr-FR")}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {exception.is_open
                      ? `Ouvert exceptionnellement · ${(exception.opening_time ?? "").slice(0, 5)} → ${(exception.closing_time ?? "").slice(0, 5)}`
                      : "Fermeture exceptionnelle"}
                    {exception.reason ? ` · ${exception.reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEditException(exception)} disabled={busy}>Modifier</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExceptionDeleteTarget(exception)} disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Aperçu */}
      <Card className="space-y-3 p-5">
        <h3 className="font-semibold">Aperçu</h3>
        <p className="text-sm text-muted-foreground">Ce que voient vos clients sur la page publique du restaurant :</p>
        <AvailabilityBadge availability={availability} timezone={timezone} />
      </Card>

      <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingException ? "Modifier l'exception" : "Ajouter une exception"}</DialogTitle>
            <DialogDescription>Une exception a toujours priorité sur le planning hebdomadaire.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={exceptionForm.date} onChange={(e) => setExceptionForm((c) => ({ ...c, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date de fin (optionnelle)</Label>
                <Input type="date" value={exceptionForm.end_date ?? ""} onChange={(e) => setExceptionForm((c) => ({ ...c, end_date: e.target.value || null }))} />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
              <span className="text-sm">Ouvert ce jour-là</span>
              <Switch checked={exceptionForm.is_open} onCheckedChange={(v) => setExceptionForm((c) => ({ ...c, is_open: v }))} />
            </label>
            {exceptionForm.is_open && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Heure d'ouverture</Label>
                  <Input type="time" value={(exceptionForm.opening_time ?? "").slice(0, 5)} onChange={(e) => setExceptionForm((c) => ({ ...c, opening_time: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Heure de fermeture</Label>
                  <Input type="time" value={(exceptionForm.closing_time ?? "").slice(0, 5)} onChange={(e) => setExceptionForm((c) => ({ ...c, closing_time: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Motif (optionnel)</Label>
              <Textarea rows={2} value={exceptionForm.reason ?? ""} onChange={(e) => setExceptionForm((c) => ({ ...c, reason: e.target.value }))} placeholder="Ex : Jour férié, fermeture annuelle..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExceptionDialogOpen(false)} disabled={busy}>Annuler</Button>
            <Button type="button" onClick={() => void saveException()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(exceptionDeleteTarget)} onOpenChange={(open) => !open && setExceptionDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette exception ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est définitive.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeException()} disabled={busy}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
