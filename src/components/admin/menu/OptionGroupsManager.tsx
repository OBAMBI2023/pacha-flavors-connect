import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilLine, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  createOption,
  createOptionGroup,
  deleteOption,
  deleteOptionGroup,
  fetchOptionGroups,
  fetchOptionsForGroups,
  updateOption,
  updateOptionGroup,
  type OptionGroup,
  type OptionGroupInput,
  type ProductOption,
  type ProductOptionInput,
} from "@/lib/productOptions";

function emptyGroupForm(): OptionGroupInput {
  return { name: "", is_required: false, max_select: 1 };
}

function emptyOptionForm(): ProductOptionInput {
  return { name: "", extra_price: 0 };
}

export function OptionGroupsManager({ restaurantId, productId }: { restaurantId: string; productId: string | null }) {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [optionsByGroup, setOptionsByGroup] = useState<Record<string, ProductOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<OptionGroup | null>(null);
  const [groupForm, setGroupForm] = useState<OptionGroupInput>(() => emptyGroupForm());
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<OptionGroup | null>(null);

  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [optionTargetGroupId, setOptionTargetGroupId] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState<ProductOption | null>(null);
  const [optionForm, setOptionForm] = useState<ProductOptionInput>(() => emptyOptionForm());
  const [optionDeleteTarget, setOptionDeleteTarget] = useState<ProductOption | null>(null);

  async function refresh() {
    if (!productId) return;
    setLoading(true);
    try {
      const fetchedGroups = await fetchOptionGroups(productId);
      const options = await fetchOptionsForGroups(fetchedGroups.map((g) => g.id));
      const map: Record<string, ProductOption[]> = {};
      for (const group of fetchedGroups) map[group.id] = [];
      for (const option of options) (map[option.option_group_id] ??= []).push(option);
      setGroups(fetchedGroups);
      setOptionsByGroup(map);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les groupes d'options.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupForm(emptyGroupForm());
    setGroupDialogOpen(true);
  }

  function openEditGroup(group: OptionGroup) {
    setEditingGroup(group);
    setGroupForm({ name: group.name, is_required: group.is_required, max_select: group.max_select ?? 1 });
    setGroupDialogOpen(true);
  }

  async function saveGroup() {
    if (!productId) return;
    if (!groupForm.name.trim()) {
      toast.error("Le nom du groupe est requis.");
      return;
    }
    if (groupForm.max_select < 1) {
      toast.error("Le nombre maximum doit être au moins 1.");
      return;
    }
    setBusy(true);
    try {
      if (editingGroup) await updateOptionGroup(editingGroup.id, groupForm);
      else await createOptionGroup(restaurantId, productId, groupForm, groups.length);
      toast.success(editingGroup ? "Groupe mis à jour" : "Groupe ajouté");
      setGroupDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer le groupe.");
    } finally {
      setBusy(false);
    }
  }

  async function removeGroup() {
    if (!groupDeleteTarget) return;
    setBusy(true);
    try {
      await deleteOptionGroup(groupDeleteTarget.id);
      toast.success("Groupe supprimé");
      setGroupDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer le groupe.");
    } finally {
      setBusy(false);
    }
  }

  function openCreateOption(groupId: string) {
    setOptionTargetGroupId(groupId);
    setEditingOption(null);
    setOptionForm(emptyOptionForm());
    setOptionDialogOpen(true);
  }

  function openEditOption(groupId: string, option: ProductOption) {
    setOptionTargetGroupId(groupId);
    setEditingOption(option);
    setOptionForm({ name: option.name, extra_price: option.extra_price });
    setOptionDialogOpen(true);
  }

  async function saveOption() {
    if (!optionTargetGroupId) return;
    if (!optionForm.name.trim()) {
      toast.error("Le nom de l'option est requis.");
      return;
    }
    setBusy(true);
    try {
      if (editingOption) await updateOption(editingOption.id, optionForm);
      else await createOption(restaurantId, optionTargetGroupId, optionForm, (optionsByGroup[optionTargetGroupId] ?? []).length);
      toast.success(editingOption ? "Option mise à jour" : "Option ajoutée");
      setOptionDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer l'option.");
    } finally {
      setBusy(false);
    }
  }

  async function removeOption() {
    if (!optionDeleteTarget) return;
    const group = groups.find((g) => g.id === optionDeleteTarget.option_group_id);
    const groupOptions = optionsByGroup[optionDeleteTarget.option_group_id] ?? [];
    if (group?.is_required && groupOptions.length <= 1) {
      toast.error("Impossible de supprimer la dernière option d'un groupe obligatoire.");
      setOptionDeleteTarget(null);
      return;
    }
    setBusy(true);
    try {
      await deleteOption(optionDeleteTarget.id);
      toast.success("Option supprimée");
      setOptionDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de supprimer l'option.");
    } finally {
      setBusy(false);
    }
  }

  if (!productId) {
    return (
      <div className="space-y-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Groupes d'options</p>
        <p>Enregistrez d'abord ce plat pour pouvoir ajouter des groupes d'options (ex : choix de sauce, taille).</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Groupes d'options</p>
        <Button type="button" size="sm" variant="outline" onClick={openCreateGroup} disabled={busy}>
          <Plus className="mr-2 h-4 w-4" /> Ajouter un groupe d'options
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun groupe d'options pour ce plat.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const options = optionsByGroup[group.id] ?? [];
            return (
              <Card key={group.id} className="space-y-3 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{group.name}</p>
                      {group.is_required && <Badge variant="secondary">Obligatoire</Badge>}
                      <Badge variant="outline">Max {group.max_select ?? 1}</Badge>
                      {group.is_required && options.length === 0 && (
                        <Badge className="gap-1 bg-destructive/10 text-destructive">
                          <TriangleAlert className="h-3 w-3" /> Aucune option disponible
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditGroup(group)} disabled={busy}>
                      <PencilLine className="mr-1.5 h-3.5 w-3.5" /> Modifier
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setGroupDeleteTarget(group)} disabled={busy}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Supprimer
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Options ({options.length})</p>
                    <Button type="button" size="sm" variant="ghost" onClick={() => openCreateOption(group.id)} disabled={busy}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter une option
                    </Button>
                  </div>
                  {options.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune option.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {options.map((option) => (
                        <li key={option.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-1.5 text-sm">
                          <span>
                            {option.name}
                            {option.extra_price > 0 && <span className="text-muted-foreground"> (+{option.extra_price.toLocaleString("fr-FR")} FCFA)</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditOption(group.id, option)} aria-label="Modifier l'option">
                              <PencilLine className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOptionDeleteTarget(option)} aria-label="Supprimer l'option">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Modifier le groupe d'options" : "Ajouter un groupe d'options"}</DialogTitle>
            <DialogDescription>Ex : « Choix de sauce », « Taille », « Suppléments ».</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom du groupe d'options</Label>
              <Input value={groupForm.name} onChange={(e) => setGroupForm((c) => ({ ...c, name: e.target.value }))} />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
              <span className="text-sm">Sélection obligatoire</span>
              <Switch checked={groupForm.is_required} onCheckedChange={(v) => setGroupForm((c) => ({ ...c, is_required: v }))} />
            </label>
            <div className="space-y-1.5">
              <Label>Nombre maximum d'options sélectionnables</Label>
              <Input type="number" min={1} value={groupForm.max_select} onChange={(e) => setGroupForm((c) => ({ ...c, max_select: Math.max(1, Number(e.target.value) || 1) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGroupDialogOpen(false)} disabled={busy}>Annuler</Button>
            <Button type="button" onClick={() => void saveGroup()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={optionDialogOpen} onOpenChange={setOptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOption ? "Modifier l'option" : "Ajouter une option"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom de l'option</Label>
              <Input value={optionForm.name} onChange={(e) => setOptionForm((c) => ({ ...c, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Prix supplémentaire (FCFA)</Label>
              <Input type="number" min={0} value={optionForm.extra_price} onChange={(e) => setOptionForm((c) => ({ ...c, extra_price: Math.max(0, Number(e.target.value) || 0) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOptionDialogOpen(false)} disabled={busy}>Annuler</Button>
            <Button type="button" onClick={() => void saveOption()} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(groupDeleteTarget)} onOpenChange={(open) => !open && setGroupDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce groupe d'options ?</AlertDialogTitle>
            <AlertDialogDescription>« {groupDeleteTarget?.name} » et toutes ses options seront définitivement supprimés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeGroup()} disabled={busy}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(optionDeleteTarget)} onOpenChange={(open) => !open && setOptionDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette option ?</AlertDialogTitle>
            <AlertDialogDescription>« {optionDeleteTarget?.name} » sera définitivement supprimée.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeOption()} disabled={busy}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
