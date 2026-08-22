import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmCashPayment, reportDeliveryIssue, type DriverActiveDelivery } from "@/lib/delivery";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  card: "Carte",
  online: "En ligne",
  unknown: "Non renseigné",
};

/**
 * The encaissement screen. Amount due and payment method are always read
 * from the order (server-authoritative) -- the driver never edits the
 * total, only enters what they physically received. Change is a client-side
 * display only; the RPC always charges `total_amount`, never what's typed
 * here.
 */
export function CashCollectionSheet({
  open,
  onOpenChange,
  activeDelivery,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeDelivery: DriverActiveDelivery;
  onConfirmed: () => void | Promise<void>;
}) {
  const [amountReceived, setAmountReceived] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [issueReason, setIssueReason] = useState("");
  const [busy, setBusy] = useState(false);

  const received = Number(amountReceived);
  const hasValidAmount = amountReceived.trim() !== "" && Number.isFinite(received) && received >= 0;
  const change = hasValidAmount ? Math.max(0, received - activeDelivery.total_amount) : null;
  const isCash = activeDelivery.payment_method === "cash";

  async function handleConfirm() {
    setBusy(true);
    try {
      await confirmCashPayment(activeDelivery.order_id, hasValidAmount ? received : null);
      toast.success("Paiement confirmé");
      setAmountReceived("");
      onOpenChange(false);
      await onConfirmed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de confirmer le paiement.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReportIssue() {
    if (!issueReason.trim()) return;
    setBusy(true);
    try {
      await reportDeliveryIssue(activeDelivery.order_id, issueReason.trim());
      toast.success("Problème signalé au restaurant");
      setReportOpen(false);
      setIssueReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de signaler le problème.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaissement</DialogTitle>
          <DialogDescription>Commande #{activeDelivery.order_number}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-border p-4">
            <span className="text-sm text-muted-foreground">Montant à encaisser</span>
            <span className="text-lg font-semibold">
              {activeDelivery.total_amount.toLocaleString("fr-FR")} {activeDelivery.currency}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Mode de paiement</span>
            <span className="font-medium">{PAYMENT_METHOD_LABELS[activeDelivery.payment_method] ?? activeDelivery.payment_method}</span>
          </div>

          {isCash && (
            <div className="space-y-2">
              <Label htmlFor="amount-received">Montant reçu</Label>
              <Input
                id="amount-received"
                type="number"
                min={0}
                inputMode="decimal"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={String(activeDelivery.total_amount)}
              />
              {change !== null && (
                <p className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Monnaie à rendre</span>
                  <span className="font-semibold">
                    {change.toLocaleString("fr-FR")} {activeDelivery.currency}
                  </span>
                </p>
              )}
            </div>
          )}

          {reportOpen && (
            <div className="space-y-2 rounded-2xl border border-destructive/40 p-4">
              <Label htmlFor="issue-reason">Décrire le problème</Label>
              <Textarea id="issue-reason" value={issueReason} onChange={(e) => setIssueReason(e.target.value)} rows={3} />
              <Button size="sm" variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10" disabled={busy || !issueReason.trim()} onClick={() => void handleReportIssue()}>
                Envoyer le signalement
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="h-12 w-full" disabled={busy || (isCash && !hasValidAmount)} onClick={() => void handleConfirm()}>
            Confirmer le paiement
          </Button>
          {!reportOpen && (
            <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10" disabled={busy} onClick={() => setReportOpen(true)}>
              Signaler un problème de paiement
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
