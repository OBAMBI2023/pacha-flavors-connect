import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicFooter } from "@/components/PublicFooter";

const TITLE = "Hôtel & Résidences — Bientôt disponible | SAOVIA";

/**
 * Placeholder only -- Hôtel & Résidences has no implemented functionality
 * anywhere in this codebase yet. No SoftwareApplication JSON-LD, no
 * canonical link, and no feature claims: nothing here may describe a
 * capability that doesn't exist. `noindex,nofollow` is set directly in this
 * page's own metadata (not left to robots.txt alone), so it holds even if a
 * crawler reaches this URL through an external link.
 */
export const Route = createFileRoute("/hotel")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HotelComingSoonPage,
});

function HotelComingSoonPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">Un produit SAOVIA</p>
        <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">Hôtel &amp; Résidences</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          Cette solution est en préparation. Revenez bientôt pour en savoir plus.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-accent"
        >
          Retour à l'accueil
        </Link>
      </main>
      <PublicFooter />
    </div>
  );
}
