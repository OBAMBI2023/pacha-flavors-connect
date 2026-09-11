import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Flag, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase-any";
import {
  fetchAdminReviews,
  fetchReviewsStats,
  hideReview,
  upsertReviewReply,
  type AdminReview,
  type ReviewsStats,
} from "@/lib/reviews";

type Filter = "all" | "5" | "4" | "3" | "2" | "1" | "unanswered" | "reported";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-3.5 w-3.5 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ReplyBox({ review, restaurantId, onSaved }: { review: AdminReview; restaurantId: string; onSaved: () => void }) {
  const [message, setMessage] = useState(review.reply?.message ?? "");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  if (!open && !review.reply) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Répondre</Button>
    );
  }
  if (!open && review.reply) {
    return (
      <div className="rounded-2xl bg-muted/60 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Votre réponse</p>
          <button onClick={() => setOpen(true)} className="text-xs font-semibold text-primary hover:underline">Modifier</button>
        </div>
        <p className="mt-1 text-sm">{review.reply.message}</p>
      </div>
    );
  }

  async function save() {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await upsertReviewReply(review.id, restaurantId, message.trim());
      toast.success("Réponse enregistrée");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer la réponse.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1000))} placeholder="Répondez au client..." rows={2} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
        <Button size="sm" onClick={() => void save()} disabled={busy}>{busy ? "Enregistrement..." : "Répondre"}</Button>
      </div>
    </div>
  );
}

export function ReviewsPanel({ restaurantId }: { restaurantId: string }) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [stats, setStats] = useState<ReviewsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  async function refresh() {
    setLoading(true);
    try {
      const [rows, s] = await Promise.all([fetchAdminReviews(restaurantId), fetchReviewsStats()]);
      setReviews(rows);
      setStats(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les avis.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    const channel = supabase
      .channel(`reviews-${restaurantId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews", filter: `restaurant_id=eq.${restaurantId}` }, () => void refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reviews", filter: `restaurant_id=eq.${restaurantId}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "5": case "4": case "3": case "2": case "1":
        return reviews.filter((r) => r.rating === Number(filter));
      case "unanswered":
        return reviews.filter((r) => !r.reply);
      case "reported":
        return reviews.filter((r) => r.report_count > 0);
      default:
        return reviews;
    }
  }, [reviews, filter]);

  async function onHide(review: AdminReview) {
    try {
      await hideReview(review.id);
      toast.success("Avis masqué");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de masquer l'avis.");
    }
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Tous" },
    { id: "5", label: "5 étoiles" },
    { id: "4", label: "4 étoiles" },
    { id: "3", label: "3 étoiles" },
    { id: "2", label: "2 étoiles" },
    { id: "1", label: "1 étoile" },
    { id: "unanswered", label: "Sans réponse" },
    { id: "reported", label: "Signalés" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Avis clients</h2>
        <p className="mt-1 text-sm text-muted-foreground">Consultez et répondez aux avis laissés par vos clients après une commande livrée.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total avis" value={stats.total_reviews} />
          <StatCard label="Note moyenne" value={stats.total_reviews > 0 ? `${stats.average_rating} / 5` : "—"} />
          <StatCard label="Sans réponse" value={stats.unanswered_reviews} />
          <StatCard label="Signalés" value={stats.reported_reviews} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Chargement...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Aucun avis pour le moment.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => (
            <Card key={review.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{review.customer_name}</p>
                    {review.order && <Badge variant="outline">#{review.order.order_number}</Badge>}
                    {review.status === "hidden" && <Badge className="bg-muted text-muted-foreground">Masqué</Badge>}
                    {review.report_count > 0 && (
                      <Badge className="bg-destructive/10 text-destructive"><Flag className="mr-1 h-3 w-3" />{review.report_count}</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <StarRow rating={review.rating} />
                    <span className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
                {review.status === "published" && (
                  <Button variant="outline" size="sm" onClick={() => void onHide(review)}>Masquer</Button>
                )}
              </div>
              {review.comment && <p className="text-sm text-foreground">{review.comment}</p>}
              <ReplyBox review={review} restaurantId={restaurantId} onSaved={refresh} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
