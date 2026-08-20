import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Order } from "@/lib/orders-db";

export function RefundDialog({
  order,
  remaining,
  busy,
  onCancel,
  onConfirm,
}: {
  order: Order | null;
  remaining: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (order: Order, amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (order) setAmount(String(remaining));
  }, [order, remaining]);

  const parsed = Number(amount);
  const valid = order !== null && Number.isFinite(parsed) && parsed > 0 && parsed <= remaining;

  return (
    <Dialog
      open={Boolean(order)}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
          setAmount("");
          setReason("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rembourser la commande {order ? `#${order.order_number}` : ""}</DialogTitle>
          <DialogDescription>
            Montant remboursable restant : {remaining.toLocaleString("fr-FR")} {order?.currency}. Cette action est
            définitive et enregistrée dans l'historique des paiements.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Montant à rembourser</span>
            <Input
              type="number"
              min={0}
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {!valid && amount !== "" && (
              <p className="text-xs text-destructive">Le montant doit être compris entre 1 et {remaining.toLocaleString("fr-FR")}.</p>
            )}
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Motif (facultatif)</span>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !valid}
            onClick={() => {
              if (!order || !valid) return;
              onConfirm(order, parsed, reason.trim());
            }}
          >
            {busy ? "Envoi..." : "Confirmer le remboursement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
