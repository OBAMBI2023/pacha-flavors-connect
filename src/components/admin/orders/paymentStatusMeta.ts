import type { PaymentMethod, PaymentStatus } from "@/lib/orders-db";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Paiement en attente",
  authorized: "Paiement autorisé",
  paid: "Payée",
  failed: "Paiement échoué",
  refunded: "Remboursée",
  partially_refunded: "Partiellement remboursée",
  cash_pending: "À encaisser (cash)",
};

export const PAYMENT_STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  authorized: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-violet-100 text-violet-800",
  partially_refunded: "bg-amber-100 text-amber-800",
  cash_pending: "bg-amber-100 text-amber-800",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  card: "Carte",
  online: "Paiement en ligne",
  unknown: "Non renseigné",
};
