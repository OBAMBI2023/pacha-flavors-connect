import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download, Printer, QrCode as QrCodeIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DbRestaurant } from "@/lib/menu-db";

const CTA_TEXT = "Scannez pour consulter le menu et commander";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("logo load failed"));
    img.src = src;
  });
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Impossible de copier -- copiez manuellement.");
  }
}

/**
 * One QR per tenant, content built purely client-side from data already
 * scoped to the authenticated admin's own restaurant (restaurantId/slug
 * come from useAuth's membership lookup upstream, never from a URL param or
 * frontend-supplied id) -- there is no server call here and nothing to gate
 * server-side beyond that existing scoping. The QR encodes only the public
 * storefront URL (origin + /r/ + slug): no internal id, token, or private
 * data ever goes into it.
 */
export function QrCodeCard({ restaurant }: { restaurant: DbRestaurant | null }) {
  const [svgMarkup, setSvgMarkup] = useState("");
  const [busyFormat, setBusyFormat] = useState<"png" | "svg" | null>(null);

  // window.location.origin, never a hardcoded IP or a saovia.com placeholder
  // -- this automatically follows wherever the app is actually served from
  // (dev IP today, the eventual production domain later) with no code change.
  const publicUrl = useMemo(() => {
    if (!restaurant?.slug || typeof window === "undefined") return null;
    return `${window.location.origin}/r/${restaurant.slug}`;
  }, [restaurant?.slug]);

  useEffect(() => {
    if (!publicUrl) {
      setSvgMarkup("");
      return;
    }
    let cancelled = false;
    QRCode.toString(publicUrl, { type: "svg", errorCorrectionLevel: "H", margin: 1, color: { dark: "#1c1917", light: "#ffffff" } })
      .then((svg) => {
        if (!cancelled) setSvgMarkup(svg);
      })
      .catch(() => {
        if (!cancelled) setSvgMarkup("");
      });
    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  async function downloadPng() {
    if (!publicUrl || !restaurant) return;
    setBusyFormat("png");
    try {
      const canvas = document.createElement("canvas");
      await QRCode.toCanvas(canvas, publicUrl, { errorCorrectionLevel: "H", width: 1024, margin: 2 });
      if (restaurant.logo_url) {
        try {
          const logo = await loadImage(restaurant.logo_url);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const size = canvas.width * 0.22;
            const x = (canvas.width - size) / 2;
            const y = (canvas.height - size) / 2;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x - 10, y - 10, size + 20, size + 20);
            ctx.drawImage(logo, x, y, size, size);
          }
        } catch {
          // Logo couldn't be composited (CORS-blocked source, load failure,
          // etc.) -- ship the plain QR rather than failing the download.
        }
      }
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `qr-${restaurant.slug}.png`;
      link.click();
    } catch {
      toast.error("Impossible de générer le QR Code PNG.");
    } finally {
      setBusyFormat(null);
    }
  }

  function downloadSvg() {
    if (!svgMarkup || !restaurant) return;
    setBusyFormat("svg");
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qr-${restaurant.slug}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    setBusyFormat(null);
  }

  function print() {
    window.print();
  }

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <QrCodeIcon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">QR Code du restaurant</h2>
          <p className="text-sm text-muted-foreground">
            Un QR unique pour {restaurant?.name ?? "ce restaurant"}, à imprimer sur vos tables ou votre vitrine --
            il ouvre uniquement votre propre page de commande.
          </p>
        </div>
      </div>

      {!publicUrl ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-6 sm:flex-row sm:items-start">
            <div className="relative shrink-0 rounded-2xl border border-border bg-white p-3">
              {svgMarkup ? (
                <div className="h-40 w-40" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
              ) : (
                <div className="h-40 w-40 animate-pulse rounded-xl bg-muted" />
              )}
              {restaurant?.logo_url && (
                <img
                  src={restaurant.logo_url}
                  alt=""
                  className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-white bg-white object-contain"
                />
              )}
            </div>
            <div className="min-w-0 space-y-2 text-center sm:text-left">
              <p className="font-display text-lg font-semibold">{restaurant?.name}</p>
              <p className="text-xs text-muted-foreground">{CTA_TEXT}</p>
              <p className="break-all rounded-lg bg-background px-2.5 py-1.5 text-xs text-muted-foreground">{publicUrl}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-11" disabled={busyFormat === "png"} onClick={() => void downloadPng()}>
              <Download className="mr-1.5 h-4 w-4" /> {busyFormat === "png" ? "Génération..." : "Télécharger PNG"}
            </Button>
            <Button variant="outline" size="sm" className="h-11" disabled={busyFormat === "svg" || !svgMarkup} onClick={downloadSvg}>
              <Download className="mr-1.5 h-4 w-4" /> Télécharger SVG
            </Button>
            <Button variant="outline" size="sm" className="h-11" onClick={print}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimer
            </Button>
            <Button variant="outline" size="sm" className="h-11" onClick={() => void copyText(publicUrl, "Lien copié")}>
              <Copy className="mr-1.5 h-4 w-4" /> Copier le lien
            </Button>
          </div>
        </>
      )}

      {/* Print-only sheet -- hidden on screen, see .qr-print-sheet in styles.css. */}
      {publicUrl && (
        <div className="qr-print-sheet" aria-hidden="true">
          <div className="qr-print-sheet__inner">
            {restaurant?.logo_url && <img src={restaurant.logo_url} alt="" className="qr-print-sheet__logo" />}
            <p className="qr-print-sheet__name">{restaurant?.name}</p>
            {svgMarkup && <div className="qr-print-sheet__qr" dangerouslySetInnerHTML={{ __html: svgMarkup }} />}
            <p className="qr-print-sheet__cta">{CTA_TEXT}</p>
            <p className="qr-print-sheet__url">{publicUrl}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
