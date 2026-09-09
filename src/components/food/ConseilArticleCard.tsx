import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { CATEGORY_TINTS, getCategory, type ConseilArticle } from "@/lib/food-conseils";

/**
 * Shared article-card markup for /food/conseils: used by the listing
 * page's grid (src/routes/food_.conseils.tsx) and the article page's
 * "Articles similaires" section (src/routes/food_.conseils_.$slug.tsx), so
 * the two never drift out of sync.
 *
 * The whole card is a single <Link> wrapping the image, title, excerpt and
 * meta row -- clicking anywhere on it navigates to the same real route.
 * "Lire l'article" is a plain <span>, not a second nested link: an <a>
 * inside another <a> is invalid HTML and would make the click target
 * ambiguous.
 */
export function ConseilArticleCard({ article }: { article: ConseilArticle }) {
  const category = getCategory(article.categorySlug);
  const tint = CATEGORY_TINTS[category.tint];

  return (
    <Link
      to="/food/conseils/$slug"
      params={{ slug: article.slug }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-[18px] border border-black/[0.08] bg-white shadow-[0_4px_20px_-8px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_36px_-12px_rgba(15,23,42,0.14)]"
    >
      <div className="relative aspect-video w-full overflow-hidden">
        <img
          src={article.image}
          alt={article.imageAlt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold ${tint.pillBg} ${tint.pillText}`}
        >
          <category.icon className="h-3 w-3" aria-hidden="true" />
          {category.title}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-bold leading-snug text-foreground group-hover:text-primary">
          {article.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {article.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {article.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {article.readingTime}
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary">
            Lire l'article <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
