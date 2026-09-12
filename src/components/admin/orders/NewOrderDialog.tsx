import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuantitySelector } from "@/components/tenant/QuantitySelector";
import { formatMoney } from "@/lib/currency";
import { useAdminMenuData, type DbMenuItem, type DbRestaurant } from "@/lib/menu-db";
import { fetchOptionGroups, fetchOptionsForGroups, type OptionGroup, type ProductOption } from "@/lib/productOptions";
import { createOrder, type CreateOrderItemInput, type CreateOrderResult, type FulfillmentType, type PaymentMethod } from "@/lib/orders-db";

type ProductOptionsBundle = { groups: OptionGroup[]; options: ProductOption[] };

type Line = {
  key: string;
  product: DbMenuItem;
  quantity: number;
  optionIds: string[];
  notes: string;
};

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Espèces" },
  { id: "mobile_money", label: "Mobile Money" },
  { id: "card", label: "Carte" },
  { id: "online", label: "En ligne" },
];

/**
 * Manual order capture for phone / WhatsApp / counter orders. Goes through the
 * exact same `create_order` RPC as the customer checkout: the restaurant is
 * never chosen by the operator (the slug comes from the admin session's own
 * restaurant), and every price, delivery fee and total shown after creation
 * comes from the RPC's authoritative response -- the local subtotal is only a
 * preview. The resulting order is an ordinary `pending` order, so the whole
 * existing workflow (statuses, payment, dispatch, drivers) applies unchanged.
 */
export function NewOrderDialog({
  open,
  restaurantId,
  restaurant,
  onClose,
  onCreated,
}: {
  open: boolean;
  restaurantId: string | null;
  restaurant: DbRestaurant | null;
  onClose: () => void;
  onCreated: (result: CreateOrderResult) => void;
}) {
  const { data: menu, isLoading: menuLoading } = useAdminMenuData(open ? restaurantId : null);
  const currency = restaurant?.currency ?? "XOF";

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("pickup");
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [customerNotes, setCustomerNotes] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [optionsByProduct, setOptionsByProduct] = useState<Record<string, ProductOptionsBundle>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (open) return;
    setCustomerName("");
    setCustomerPhone("");
    setFulfillmentType("pickup");
    setCommune("");
    setAddress("");
    setInstructions("");
    setPaymentMethod("cash");
    setCustomerNotes("");
    setSearch("");
    setLines([]);
    setError(null);
  }, [open]);

  const products = useMemo(() => {
    const rows = (menu?.rows ?? []).filter((r) => r.available && r.price != null);
    const q = search.trim().toLowerCase();
    if (!q) return rows.slice(0, 30);
    return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.subtitle ?? "").toLowerCase().includes(q)).slice(0, 30);
  }, [menu?.rows, search]);

  async function loadOptions(productId: string) {
    if (optionsByProduct[productId]) return;
    try {
      const groups = await fetchOptionGroups(productId);
      const options = groups.length > 0 ? await fetchOptionsForGroups(groups.map((g) => g.id)) : [];
      setOptionsByProduct((prev) => ({ ...prev, [productId]: { groups, options } }));
    } catch {
      setOptionsByProduct((prev) => ({ ...prev, [productId]: { groups: [], options: [] } }));
    }
  }

  function addProduct(product: DbMenuItem) {
    void loadOptions(product.id);
    setLines((prev) => [
      ...prev,
      { key: `${product.id}-${Date.now()}-${prev.length}`, product, quantity: 1, optionIds: [], notes: "" },
    ]);
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function toggleOption(line: Line, group: OptionGroup, optionId: string) {
    const bundle = optionsByProduct[line.product.id];
    const groupOptionIds = (bundle?.options ?? []).filter((o) => o.option_group_id === group.id).map((o) => o.id);
    const others = line.optionIds.filter((id) => !groupOptionIds.includes(id));
    const selectedInGroup = line.optionIds.filter((id) => groupOptionIds.includes(id));
    const isSelected = selectedInGroup.includes(optionId);
    const maxSelect = group.max_select ?? (group.selection_type === "single" ? 1 : groupOptionIds.length);

    let next: string[];
    if (group.selection_type === "single" || maxSelect === 1) {
      next = isSelected && !group.is_required ? [] : [optionId];
    } else if (isSelected) {
      next = selectedInGroup.filter((id) => id !== optionId);
    } else {
      if (selectedInGroup.length >= maxSelect) return;
      next = [...selectedInGroup, optionId];
    }
    updateLine(line.key, { optionIds: [...others, ...next] });
  }

  function lineUnitPrice(line: Line) {
    const bundle = optionsByProduct[line.product.id];
    const extras = (bundle?.options ?? [])
      .filter((o) => line.optionIds.includes(o.id))
      .reduce((sum, o) => sum + Number(o.extra_price ?? 0), 0);
    return Number(line.product.price ?? 0) + extras;
  }

  const subtotalPreview = lines.reduce((sum, l) => sum + lineUnitPrice(l) * l.quantity, 0);

  const missingRequired = lines.some((line) => {
    const bundle = optionsByProduct[line.product.id];
    if (!bundle) return false;
    return bundle.groups.some((g) => {
      if (!g.is_required) return false;
      const ids = bundle.options.filter((o) => o.option_group_id === g.id).map((o) => o.id);
      return !line.optionIds.some((id) => ids.includes(id));
    });
  });

  const canSubmit =
    Boolean(restaurant?.slug) &&
    customerName.trim().length > 1 &&
    customerPhone.trim().length >= 8 &&
    lines.length > 0 &&
    !missingRequired &&
    (fulfillmentType === "pickup" || (commune.trim().length > 0 && address.trim().length > 2)) &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || submittingRef.current || !restaurant?.slug) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const items: CreateOrderItemInput[] = lines.map((l) => ({
        product_id: l.product.id,
        quantity: l.quantity,
        ...(l.optionIds.length > 0 ? { option_ids: l.optionIds } : {}),
        ...(l.notes.trim() ? { notes: l.notes.trim() } : {}),
      }));
      const result = await createOrder({
        slug: restaurant.slug,
        fulfillmentType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items,
        deliveryCommune: fulfillmentType === "delivery" ? commune.trim() : undefined,
        deliveryAddress: fulfillmentType === "delivery" ? address.trim() : undefined,
        deliveryInstructions: fulfillmentType === "delivery" && instructions.trim() ? instructions.trim() : undefined,
        customerNotes: customerNotes.trim() || undefined,
        orderSource: "direct",
        sourceMetadata: { manual: "true", entry: "admin_dashboard" },
        paymentMethod,
      });
      toast.success(`Commande #${result.order_number} créée`, {
        description: `Total ${formatMoney(result.total_amount, result.currency)}`,
      });
      onCreated(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la commande.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !submitting) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle commande</DialogTitle>
          <DialogDescription>
            Commande prise par téléphone, WhatsApp ou au comptoir. Les prix et le total final sont calculés par le serveur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mo-name">Nom du client *</Label>
              <Input id="mo-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Awa Koné" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo-phone">Téléphone *</Label>
              <Input id="mo-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07 07 17 05 14" inputMode="tel" className="h-11" />
            </div>
          </section>

          <section className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              {([{ id: "pickup", label: "Retrait sur place" }, { id: "delivery", label: "Livraison" }] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFulfillmentType(m.id)}
                  className={`h-11 flex-1 rounded-full border px-4 text-sm font-medium transition-colors ${
                    fulfillmentType === m.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          {fulfillmentType === "delivery" && (
            <section className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mo-commune">Commune *</Label>
                  <Input id="mo-commune" value={commune} onChange={(e) => setCommune(e.target.value)} placeholder="Cocody" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mo-address">Adresse *</Label>
                  <Input id="mo-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Angré 8e Tranche, rue ..." className="h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mo-instructions">Instructions de livraison</Label>
                <Textarea id="mo-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="Portail bleu, appeler à l'arrivée" />
              </div>
              <p className="text-xs text-muted-foreground">
                Les frais de livraison sont calculés automatiquement par le serveur à la création de la commande.
              </p>
            </section>
          )}

          <section className="space-y-3">
            <Label>Articles *</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un plat..." className="h-11 pl-9" />
            </div>

            {menuLoading ? (
              <p className="text-sm text-muted-foreground">Chargement du menu...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun plat disponible pour cette recherche.</p>
            ) : (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 font-semibold">{formatMoney(Number(p.price ?? 0), currency)}</span>
                  </button>
                ))}
              </div>
            )}

            {lines.length > 0 && (
              <div className="space-y-3">
                {lines.map((line) => {
                  const bundle = optionsByProduct[line.product.id];
                  return (
                    <div key={line.key} className="space-y-3 rounded-2xl border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{line.product.name}</p>
                          <p className="text-xs text-muted-foreground">{formatMoney(lineUnitPrice(line), currency)} / unité</p>
                        </div>
                        <button type="button" onClick={() => removeLine(line.key)} aria-label="Retirer l'article" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {bundle?.groups.map((group) => {
                        const groupOptions = bundle.options.filter((o) => o.option_group_id === group.id);
                        if (groupOptions.length === 0) return null;
                        return (
                          <div key={group.id} className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {group.name}
                              {group.is_required ? " *" : ""}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {groupOptions.map((o) => {
                                const active = line.optionIds.includes(o.id);
                                return (
                                  <button
                                    key={o.id}
                                    type="button"
                                    onClick={() => toggleOption(line, group, o.id)}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
                                    }`}
                                  >
                                    {o.name}
                                    {Number(o.extra_price) > 0 ? ` +${formatMoney(Number(o.extra_price), currency)}` : ""}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      <Input
                        value={line.notes}
                        onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                        placeholder="Note pour cet article (facultatif)"
                        className="h-10"
                      />

                      <div className="flex items-center justify-between">
                        <QuantitySelector
                          value={line.quantity}
                          onIncrement={() => updateLine(line.key, { quantity: line.quantity + 1 })}
                          onDecrement={() => updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                          decrementDisabled={line.quantity <= 1}
                        />
                        <span className="font-semibold">{formatMoney(lineUnitPrice(line) * line.quantity, currency)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <Label>Paiement</Label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
                    paymentMethod === m.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="mo-notes">Notes de commande</Label>
            <Textarea id="mo-notes" value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={2} placeholder="Sans piment, couverts en plus..." />
          </section>

          <section className="space-y-1 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sous-total (aperçu)</span>
              <span className="font-semibold">{formatMoney(subtotalPreview, currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Frais de livraison</span>
              <span>{fulfillmentType === "delivery" ? "Calculés par le serveur" : "--"}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Le total définitif est celui renvoyé par le serveur après création.
            </p>
          </section>

          {missingRequired && (
            <p className="text-sm text-destructive">Certaines options obligatoires ne sont pas encore choisies.</p>
          )}
          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="h-11" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button className="h-11" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {submitting ? "Création..." : "Créer la commande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
