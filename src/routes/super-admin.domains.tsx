import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Globe, Loader2, Plus, ShieldCheck, Star, Trash2 } from "lucide-react";
import {
  addTenantDomain,
  deleteTenantDomain,
  fetchAllTenantDomains,
  normalizeDomain,
  setPrimaryTenantDomain,
  setTenantDomainActive,
  verificationHost,
  verifyTenantDomain,
  type TenantDomain,
} from "@/lib/tenantDomains";
import { fetchTenants, type TenantRow } from "@/lib/superAdminTenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/super-admin/domains")({
  ssr: false,
  component: SuperAdminDomainsPage,
});

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copié");
  } catch {
    toast.error("Impossible de copier -- copiez manuellement.");
  }
}

function SuperAdminDomainsPage() {
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newTenantId, setNewTenantId] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const tenantsById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);

  async function reload() {
    setLoading(true);
    try {
      const [domainRows, tenantRows] = await Promise.all([fetchAllTenantDomains(), fetchTenants()]);
      setDomains(domainRows);
      setTenants(tenantRows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les domaines.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTenantId || !newDomain.trim()) return;
    setAdding(true);
    try {
      await addTenantDomain(newTenantId, newDomain);
      toast.success("Domaine ajouté -- en attente de vérification DNS.");
      setAddOpen(false);
      setNewTenantId("");
      setNewDomain("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'ajouter ce domaine.");
    } finally {
      setAdding(false);
    }
  }

  async function handleVerify(domain: TenantDomain) {
    setBusyId(domain.id);
    try {
      const result = await verifyTenantDomain(domain);
      if (result.verified) toast.success(result.message);
      else toast.error(result.message);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vérification impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(domain: TenantDomain, next: boolean) {
    setBusyId(domain.id);
    try {
      await setTenantDomainActive(domain.id, next);
      toast.success(next ? "Domaine activé." : "Domaine désactivé.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetPrimary(domain: TenantDomain) {
    setBusyId(domain.id);
    try {
      await setPrimaryTenantDomain(domain.id);
      toast.success("Domaine défini comme principal.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(domain: TenantDomain) {
    setBusyId(domain.id);
    try {
      await deleteTenantDomain(domain.id);
      toast.success("Domaine supprimé.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Domaines</h1>
          <p className="mt-1 text-sm text-slate-600">
            Domaines personnalisés des tenants -- vérification DNS obligatoire avant activation. Tant qu'aucun domaine
            n'est vérifié, actif et principal, un tenant reste sur son adresse SAOVIA (saovia.net/r/&lt;slug&gt;).
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> Ajouter un domaine
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAdd}>
              <DialogHeader>
                <DialogTitle>Ajouter un domaine</DialogTitle>
                <DialogDescription>
                  Le domaine reste inactif tant qu'il n'a pas été vérifié par DNS.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Tenant</Label>
                  <Select value={newTenantId} onValueChange={setNewTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un restaurant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.slug})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-domain">Domaine</Label>
                  <Input
                    id="new-domain"
                    placeholder="mon-resto.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    required
                  />
                  {newDomain.trim() && (
                    <p className="text-xs text-muted-foreground">Sera enregistré comme : {normalizeDomain(newDomain)}</p>
                  )}
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="submit" disabled={adding || !newTenantId || !newDomain.trim()}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
          </div>
        ) : domains.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-slate-500">
            <Globe className="h-8 w-8 text-slate-300" />
            Aucun domaine personnalisé pour le moment.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Domaine</TableHead>
                <TableHead>Statut DNS</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => {
                const tenant = tenantsById.get(domain.tenant_id);
                const rowBusy = busyId === domain.id;
                return (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium">
                      {tenant ? (
                        <>
                          {tenant.name}
                          <span className="ml-1.5 text-xs text-muted-foreground">({tenant.slug})</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Tenant introuvable</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{domain.domain}</div>
                      {!domain.is_verified && (
                        <div className="mt-1.5 space-y-1 rounded-lg border border-dashed border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                          <p>Ajoutez un enregistrement DNS TXT :</p>
                          <div className="flex items-center gap-1.5">
                            <code className="rounded bg-background px-1.5 py-0.5">{verificationHost(domain.domain)}</code>
                            <button
                              type="button"
                              onClick={() => void copyText(verificationHost(domain.domain))}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Copier l'hôte"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <code className="rounded bg-background px-1.5 py-0.5">{domain.verification_token}</code>
                            <button
                              type="button"
                              onClick={() => void copyText(domain.verification_token)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Copier le jeton"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {domain.is_verified ? (
                        <Badge variant="secondary" className="gap-1 text-emerald-700">
                          <ShieldCheck className="h-3 w-3" /> Vérifié
                        </Badge>
                      ) : (
                        <Badge variant="outline">En attente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={domain.is_active}
                        disabled={rowBusy || (!domain.is_active && !domain.is_verified)}
                        onCheckedChange={(next) => void handleToggleActive(domain, next)}
                        aria-label="Actif"
                      />
                    </TableCell>
                    <TableCell>
                      {domain.is_primary ? (
                        <Badge className="gap-1">
                          <Star className="h-3 w-3" /> Principal
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          disabled={rowBusy || !domain.is_verified || !domain.is_active}
                          onClick={() => void handleSetPrimary(domain)}
                        >
                          Définir principal
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!domain.is_verified && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={rowBusy}
                            onClick={() => void handleVerify(domain)}
                          >
                            {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Vérifier"}
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={rowBusy}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce domaine ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {domain.domain} ne sera plus utilisable pour {tenant?.name ?? "ce tenant"}. Cette action
                                est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void handleDelete(domain)}>Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
