import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Order } from "@/lib/orders-db";

const REASONS = [
  "Produit indisponible",
  "Restaurant fermé",
  "Impossible de préparer la commande",
  "Adresse non desservie",
  "Autre",
] as const;
const DEFAULT_REASON: string = REASONS[0];

export function RejectOrderDialog({
  order,
  busy,
  onCancel,
  onConfirm,
}: {
  order: Order | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (order: Order, reason: string) => void;
}) {
  const [reason, setReason] = useState<string>(DEFAULT_REASON);
  const [detail, setDetail] = useState("");

  return (
    <Dialog
      open={Boolean(order)}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
          setReason(REASONS[0]);
          setDetail("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuser la commande {order ? `#${order.order_number}` : ""}</DialogTitle>
          <DialogDescription>
            Cette action est définitive. La commande sera marquée comme annulée, jamais supprimée.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Motif</span>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Précision (facultatif)</span>
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (!order) return;
              const full = detail.trim() ? `${reason} — ${detail.trim()}` : reason;
              onConfirm(order, full);
            }}
          >
            {busy ? "Envoi..." : "Refuser la commande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
