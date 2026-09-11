import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { siteOrigin } from "@/lib/seo";

export const Route = createFileRoute("/restaurants/categorie/$categorySlug")({
  // Placeholder page (no server-side category filtering implemented yet --
  // see CategoryPage below), so noindex until it has real content. Remove
  // once this actually filters restaurants by category.
  head: ({ params }) => ({
    meta: [
      { title: `${params.categorySlug} — Restaurants et menus | SAOVIA` },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `${siteOrigin()}/restaurants/categorie/${params.categorySlug}` }],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { categorySlug } = Route.useParams();
  return (
    <MarketplaceShell
      eyebrow="Catégorie"
      title={categorySlug}
      subtitle="Les restaurants associés à cette catégorie seront affichés ici."
      searchHref="/rechercher"
      ctas={<Link to="/restaurants" className="rounded-full border border-border px-5 py-3 text-sm font-semibold">Restaurants</Link>}
    >
      <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
        Cette page est prête pour le filtrage serveur par catégorie.
      </div>
    </MarketplaceShell>
  );
}
