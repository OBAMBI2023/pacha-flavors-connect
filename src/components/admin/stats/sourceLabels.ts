import type { OrderSource } from "@/lib/orders-db";

export const SOURCE_LABELS: Record<OrderSource, string> = {
  direct: "Vitrine directe",
  marketplace: "Marketplace SAOVIA",
  qr_code: "QR Code",
  unknown: "Non attribuée",
};
