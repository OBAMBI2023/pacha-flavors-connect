import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchReviewReports,
  setReviewReportStatus,
  setReviewVisibility,
  REPORT_REASON_LABELS,
  type AdminReviewReport,
  type ReportStatus,
} from "@/lib/reviews";

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "En attente",
  under_review: "En cours d'examen",
  resolved: "Résolu",
  dismissed: "Rejeté",
};
const STATUS_BADGE: Record<ReportStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  under_review: "bg-sky-100 text-sky-800",
  resolved: "bg-emerald-100 text-emerald-800",
  dismissed: "bg-slate-200 text-slate-600",
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-3.5 w-3.5 ${n <= rating ? "fill-cyan-400 text-cyan-400" : "text-slate-600"}`} />
      ))}
    </div>
  );
}

export function ReviewReportsSection() {
  const [reports, setReports] = useState<AdminReviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | "all">("pending");

  async function refresh() {
    setLoading(true);
    try {
      setReports(await fetchReviewReports());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les signalements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`review-reports-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "review_reports" }, () => void refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "review_reports" }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => (filter === "all" ? reports : reports.filter((r) => r.status === filter)), [reports, filter]);

  async function updateStatus(report: AdminReviewReport, status: ReportStatus) {
    try {
      await setReviewReportStatus(report.id, status);
      toast.success("Signalement mis à jour");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour le signalement.");
    }
  }

  async function moderateReview(report: AdminReviewReport, action: "hide" | "restore") {
    try {
      await setReviewVisibility(report.review_id, action === "hide" ? "hidden" : "published");
      toast.success(action === "hide" ? "Avis masqué" : "Avis restauré");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  }

  const filters: { id: ReportStatus | "all"; label: string }[] = [
    { id: "pending", label: "En attente" },
    { id: "under_review", label: "En cours" },
    { id: "resolved", label: "Résolus" },
    { id: "dismissed", label: "Rejetés" },
    { id: "all", label: "Tous" },
  ];

  return (
    <section id="avis" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Signalements d'avis</h2>
          <p className="mt-1 text-sm text-slate-500">Avis signalés par des clients ou des tenants, tous restaurants confondus.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                filter === f.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun signalement pour ce filtre.</p>
        ) : (
          filtered.map((report) => (
            <div key={report.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{report.restaurant?.name ?? "Restaurant"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${STATUS_BADGE[report.status]}`}>{STATUS_LABELS[report.status]}</span>
                    {report.review?.status === "hidden" && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[0.7rem] font-semibold text-slate-600">Avis masqué</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Motif : {REPORT_REASON_LABELS[report.reason]} · Signalé par {report.reporter_type === "customer" ? "un client" : "le tenant"} · {new Date(report.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>

              {report.review && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <StarRow rating={report.review.rating} />
                    <span className="text-xs text-slate-500">{report.review.customer_name}</span>
                  </div>
                  {report.review.comment && <p className="mt-1 text-sm text-slate-700">{report.review.comment}</p>}
                </div>
              )}
              {report.description && <p className="mt-2 text-sm text-slate-600">« {report.description} »</p>}

              <div className="mt-3 flex flex-wrap gap-2">
                {report.status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => void updateStatus(report, "under_review")}>Marquer en cours</Button>
                )}
                {(report.status === "pending" || report.status === "under_review") && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => void updateStatus(report, "dismissed")}>Rejeter (non fondé)</Button>
                    <Button size="sm" onClick={() => void updateStatus(report, "resolved")}>Marquer résolu</Button>
                  </>
                )}
                {report.review?.status === "published" ? (
                  <Button size="sm" variant="destructive" onClick={() => void moderateReview(report, "hide")}>Masquer l'avis</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void moderateReview(report, "restore")}>Restaurer l'avis</Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
