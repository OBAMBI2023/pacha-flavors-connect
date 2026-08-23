import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Star, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrCreateVisitorId } from "@/lib/visitorTracking";
import { fetchOrderReview, reportReview, submitReview, updateReview, type OrderReview } from "@/lib/reviews";
import type { OrderStatus } from "@/lib/orders";

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          className="p-0.5"
        >
          <Star className={`h-8 w-8 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

const REPORT_REASONS: { value: import("@/lib/reviews").ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harcèlement" },
  { value: "offensive_content", label: "Contenu offensant" },
  { value: "false_review", label: "Faux avis" },
  { value: "inappropriate_content", label: "Contenu inapproprié" },
  { value: "other", label: "Autre" },
];

export function OrderReviewSection({ orderId, customerPhone, orderStatus }: { orderId: string; customerPhone: string; orderStatus: OrderStatus }) {
  const [review, setReview] = useState<OrderReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (orderStatus !== "delivered" || !customerPhone) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchOrderReview(orderId, customerPhone)
      .then((r) => {
        if (cancelled) return;
        setReview(r);
        if (r) {
          setRating(r.rating);
          setComment(r.comment ?? "");
        }
      })
      .catch((err: unknown) => console.warn("[reviews]", err instanceof Error ? err.message : err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId, customerPhone, orderStatus]);

  async function submit() {
    if (rating < 1) {
      toast.error("Merci de choisir une note.");
      return;
    }
    setSubmitting(true);
    try {
      if (review) {
        await updateReview({ reviewId: review.id, customerPhone, rating, comment: comment.trim() || null });
        toast.success("Avis mis à jour");
      } else {
        await submitReview({ orderId, customerPhone, rating, comment: comment.trim() || null, visitorId: getOrCreateVisitorId() });
        toast.success("Merci pour votre avis !");
      }
      const fresh = await fetchOrderReview(orderId, customerPhone);
      setReview(fresh);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer votre avis.");
    } finally {
      setSubmitting(false);
    }
  }

  if (orderStatus !== "delivered" || loading) return null;

  const showForm = !review || editing;

  return (
    <div className="mt-4 rounded-3xl border border-border bg-card p-5">
      {showForm ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Donnez votre avis</h3>
            <p className="text-sm text-muted-foreground">Votre commande est terminée. Comment s'est passée votre expérience ?</p>
          </div>
          <StarPicker value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            maxLength={1000}
            rows={3}
            placeholder="Partagez votre expérience..."
            className="w-full resize-none rounded-2xl border border-input bg-card p-3 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            {editing && (
              <Button variant="outline" onClick={() => { setEditing(false); if (review) { setRating(review.rating); setComment(review.comment ?? ""); } }}>
                Annuler
              </Button>
            )}
            <Button className="flex-1" onClick={() => void submit()} disabled={submitting}>
              {submitting ? "Envoi..." : "Publier mon avis"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Votre avis</h3>
            <button onClick={() => setEditing(true)} className="text-sm font-semibold text-primary hover:underline">Modifier</button>
          </div>
          <StarDisplay rating={review.rating} />
          {review.comment && <p className="text-sm text-foreground">{review.comment}</p>}
          <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString("fr-FR")}</p>

          {review.reply && (
            <div className="rounded-2xl bg-muted/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Réponse du restaurant</p>
              <p className="mt-1 text-sm text-foreground">{review.reply.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(review.reply.created_at).toLocaleDateString("fr-FR")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Standalone report action for a review shown outside the customer's own order (e.g. a future public reviews listing) -- not wired to any page yet, kept here so it's ready when that listing exists rather than being invented twice. */
export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<import("@/lib/reviews").ReportReason>("spam");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await reportReview({ reviewId, reason, description: description.trim() || null, visitorId: getOrCreateVisitorId() });
      toast.success("Signalement envoyé");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'envoyer le signalement.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
        <Flag className="h-3 w-3" /> Signaler
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-sm">
      <p className="font-semibold">Signaler cet avis</p>
      <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="mt-2 w-full rounded-lg border border-input bg-card px-2 py-1.5 text-sm">
        {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
        placeholder="Expliquez le problème..."
        rows={2}
        className="mt-2 w-full resize-none rounded-lg border border-input bg-card p-2 text-sm outline-none"
      />
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
        <Button size="sm" onClick={() => void submit()} disabled={submitting}>{submitting ? "Envoi..." : "Envoyer le signalement"}</Button>
      </div>
    </div>
  );
}
