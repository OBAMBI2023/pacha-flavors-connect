import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminMenuData, type DbMenuItem, type DbRestaurant } from "@/lib/menu-db";
import {
  fetchOptionGroups,
  fetchOptionsForGroups,
  type OptionGroup,
  type ProductOption,
  type SelectionType,
} from "@/lib/productOptions";
import {
  createOrder,
  type CreateOrderItemInput,
  type FulfillmentType,
  type PaymentMethod,
} from "@/lib/orders-db";
import { formatMoney } from "@/lib/currency";
import { PAYMENT_METHOD_LABELS } from "./paymentStatusMeta";

type CartLine = {
  lineId: string;
  product: DbMenuItem;
  quantity: number;
  note: string;
  optionGroups: OptionGroup[];
  optionsByGroup: Record<string, ProductOption[]>;
  selectedOptionIds: Record<string, string[]>;
  optionsLoading: boolean;
};

/** Real "unknown" is create_order's own fallback for an invalid value, never something staff should pick on purpose. */
const PAYMENT_METHOD_CHOICES: PaymentMethod[] = ["cash", "mobile_money", "card", "online"];

let lineCounter = 0;
function nextLineId(): string {
  lineCounter += 1;
  return `line-${lineCounter}`;
}

function emptyDeliveryFields() {
  return { commune: "", address: "", instructions: "" };
}

function toggleButtonClass(active: boolean) {
  return `flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card hover:bg-accent"
  }`;
}

/**
 * "+ Nouvelle commande" -- lets staff record a phone/counter order through
 * the exact same `create_order` RPC as a real storefront checkout (via the
 * existing `createOrder` wrapper in orders-db.ts), so it re-validates every
 * product/option and recomputes every price server-side exactly like a
 * customer order would. `restaurant.slug` always comes from the already
 * -authenticated admin session (never a field staff can edit), so this can
 * only ever create an order for the admin's own tenant. The created row
 * lands in the dashboard through the existing realtime `orders` INSERT
 * subscription (useRealtimeOrders) -- no separate refetch here.
 */
export function NewOrderDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  restaurant: DbRestaurant | null;
}) {
  const { data } = useAdminMenuData(restaurantId);
  const currency = restaurant?.currency ?? null;

  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("pickup");
  const [delivery, setDelivery] = useState(emptyDeliveryFields());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [orderNotes, setOrderNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setSearch("");
    setCustomerName("");
    setCustomerPhone("");
    setFulfillmentType("pickup");
    setDelivery(emptyDeliveryFields());
    setPaymentMethod("cash");
    setOrderNotes("");
    setCart([]);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (submitting) return; // ignore overlay/Escape while a submission is in flight
      reset();
    }
    onOpenChange(next);
  }

  const filteredProducts = useMemo(() => {
    const products = data?.rows ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [data?.rows, search]);

  async function addProduct(product: DbMenuItem) {
    const lineId = nextLineId();
    setCart((current) => [
      ...current,
      {
        lineId,
        product,
        quantity: 1,
        note: "",
        optionGroups: [],
        optionsByGroup: {},
        selectedOptionIds: {},
        optionsLoading: true,
      },
    ]);
    try {
      const groups = await fetchOptionGroups(product.id);
      const options = await fetchOptionsForGroups(groups.map((g) => g.id));
      const optionsByGroup: Record<string, ProductOption[]> = {};
      for (const g of groups) optionsByGroup[g.id] = [];
      for (const o of options) (optionsByGroup[o.option_group_id] ??= []).push(o);
      setCart((current) =>
        current.map((line) =>
          line.lineId === lineId
            ? { ...line, optionGroups: groups, optionsByGroup, optionsLoading: false }
            : line,
        ),
      );
    } catch (err) {
      setCart((current) =>
        current.map((line) => (line.lineId === lineId ? { ...line, optionsLoading: false } : line)),
      );
      toast.error(
        err instanceof Error ? err.message : "Impossible de charger les options de ce produit.",
      );
    }
  }

  function removeLine(lineId: string) {
    setCart((current) => current.filter((l) => l.lineId !== lineId));
  }

  function updateQuantity(lineId: string, delta: number) {
    setCart((current) =>
      current.map((l) =>
        l.lineId === lineId ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l,
      ),
    );
  }

  function updateNote(lineId: string, note: string) {
    setCart((current) => current.map((l) => (l.lineId === lineId ? { ...l, note } : l)));
  }

  function toggleOption(
    lineId: string,
    groupId: string,
    optionId: string,
    selectionType: SelectionType,
    maxSelect: number | null,
  ) {
    setCart((current) =>
      current.map((line) => {
        if (line.lineId !== lineId) return line;
        const currentIds = line.selectedOptionIds[groupId] ?? [];
        let nextIds: string[];
        if (selectionType === "single") {
          nextIds = currentIds.includes(optionId) ? [] : [optionId];
        } else if (currentIds.includes(optionId)) {
          nextIds = currentIds.filter((id) => id !== optionId);
        } else {
          const max = maxSelect ?? Infinity;
          if (currentIds.length >= max) return line;
          nextIds = [...currentIds, optionId];
        }
        return { ...line, selectedOptionIds: { ...line.selectedOptionIds, [groupId]: nextIds } };
      }),
    );
  }

  function lineTotal(line: CartLine): number {
    const optionsExtra = line.optionGroups.reduce((sum, group) => {
      const ids = line.selectedOptionIds[group.id] ?? [];
      const options = line.optionsByGroup[group.id] ?? [];
      return (
        sum + ids.reduce((s, id) => s + (options.find((o) => o.id === id)?.extra_price ?? 0), 0)
      );
    }, 0);
    return ((line.product.price ?? 0) + optionsExtra) * line.quantity;
  }

  // Display-only preview -- create_order independently re-validates every
  // product/option and recomputes subtotal/delivery fee/total server-side;
  // this never doubles as what actually gets charged.
  const previewTotal = cart.reduce((sum, line) => sum + lineTotal(line), 0);

  const cartRequiredSatisfied = cart.every((line) =>
    line.optionGroups.every(
      (group) =>
        !group.is_required ||
        (line.selectedOptionIds[group.id]?.length ?? 0) >= Math.max(group.min_select, 1),
    ),
  );

  const canSubmit =
    !submitting &&
    Boolean(restaurant) &&
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    cart.length > 0 &&
    cartRequiredSatisfied &&
    (fulfillmentType !== "delivery" || delivery.address.trim().length > 0);

  async function handleSubmit() {
    if (submitting || !restaurant || !canSubmit) return;
    setSubmitting(true);
    try {
      const items: CreateOrderItemInput[] = cart.map((line) => {
        const optionIds = line.optionGroups.flatMap(
          (group) => line.selectedOptionIds[group.id] ?? [],
        );
        return {
          product_id: line.product.id,
          quantity: line.quantity,
          ...(optionIds.length > 0 ? { option_ids: optionIds } : {}),
          ...(line.note.trim() ? { notes: line.note.trim() } : {}),
        };
      });
      const result = await createOrder({
        slug: restaurant.slug,
        fulfillmentType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items,
        deliveryCommune:
          fulfillmentType === "delivery" ? delivery.commune.trim() || undefined : undefined,
        deliveryAddress:
          fulfillmentType === "delivery" ? delivery.address.trim() || undefined : undefined,
        deliveryInstructions:
          fulfillmentType === "delivery" ? delivery.instructions.trim() || undefined : undefined,
        customerNotes: orderNotes.trim() || undefined,
        orderSource: "direct",
        sourceMetadata: { source: "admin_dashboard" },
        paymentMethod,
      });
      toast.success(`Commande #${result.order_number} créée`, {
        description: formatMoney(result.total_amount, result.currency),
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer cette commande.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle commande</DialogTitle>
          <DialogDescription>
            Pour une commande prise par téléphone ou au comptoir -- les prix et le total définitifs
            sont recalculés par le serveur à la validation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nom du client *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone *</Label>
              <Input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setFulfillmentType("pickup")}
                className={toggleButtonClass(fulfillmentType === "pickup")}
              >
                Retrait sur place
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setFulfillmentType("delivery")}
                className={toggleButtonClass(fulfillmentType === "delivery")}
              >
                Livraison
              </button>
            </div>
          </div>

          {fulfillmentType === "delivery" && (
            <div className="space-y-4 rounded-2xl border border-border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Commune</Label>
                  <Input
                    value={delivery.commune}
                    onChange={(e) => setDelivery((c) => ({ ...c, commune: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Adresse *</Label>
                  <Input
                    value={delivery.address}
                    onChange={(e) => setDelivery((c) => ({ ...c, address: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Instructions de livraison</Label>
                <Textarea
                  rows={2}
                  value={delivery.instructions}
                  onChange={(e) => setDelivery((c) => ({ ...c, instructions: e.target.value }))}
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Produits</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rechercher un produit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
              {filteredProducts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Aucun produit trouvé.
                </p>
              ) : (
                filteredProducts.map((product) => {
                  const disabled = submitting || !product.available || product.price === null;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => void addProduct(product)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {product.name}
                        {!product.available && (
                          <span className="ml-2 text-xs text-muted-foreground">(indisponible)</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {product.price === null
                          ? "Prix à définir"
                          : formatMoney(product.price, currency)}
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {cart.length > 0 && (
            <div className="space-y-3">
              <Label>Articles ({cart.length})</Label>
              {cart.map((line) => (
                <div key={line.lineId} className="space-y-3 rounded-2xl border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(lineTotal(line), currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.lineId, -1)}
                        disabled={submitting || line.quantity <= 1}
                        aria-label="Diminuer la quantité"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.lineId, 1)}
                        disabled={submitting}
                        aria-label="Augmenter la quantité"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(line.lineId)}
                        disabled={submitting}
                        aria-label="Retirer cet article"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {line.optionsLoading ? (
                    <p className="text-xs text-muted-foreground">Chargement des options...</p>
                  ) : (
                    line.optionGroups.map((group) => {
                      const options = line.optionsByGroup[group.id] ?? [];
                      if (options.length === 0) return null;
                      const selectedIds = line.selectedOptionIds[group.id] ?? [];
                      const satisfied =
                        !group.is_required || selectedIds.length >= Math.max(group.min_select, 1);
                      return (
                        <div key={group.id} className="space-y-1.5">
                          <p className="text-xs font-medium">
                            {group.name}{" "}
                            {group.is_required && <span className="text-destructive">*</span>}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {options.map((option) => {
                              const isSelected = selectedIds.includes(option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  disabled={submitting}
                                  onClick={() =>
                                    toggleOption(
                                      line.lineId,
                                      group.id,
                                      option.id,
                                      group.selection_type,
                                      group.max_select,
                                    )
                                  }
                                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-card hover:bg-accent"
                                  }`}
                                >
                                  {option.name}
                                  {option.extra_price > 0 && (
                                    <span className="ml-1 opacity-80">
                                      +{formatMoney(option.extra_price, currency)}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {!satisfied && (
                            <p className="text-xs font-medium text-destructive">
                              Sélection requise
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}

                  <Input
                    placeholder="Note pour cet article (facultatif)"
                    value={line.note}
                    onChange={(e) => updateNote(line.lineId, e.target.value)}
                    disabled={submitting}
                    className="h-9 text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_CHOICES.map((method) => (
                    <SelectItem key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note de commande (facultatif)</Label>
            <Textarea
              rows={2}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Aperçu :{" "}
            <span className="font-semibold text-foreground">
              {formatMoney(previewTotal, currency)}
            </span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {submitting ? "Création..." : "Créer la commande"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
