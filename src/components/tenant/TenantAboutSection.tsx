import type { AboutSection } from "@/lib/menu-db";
import { resolveAboutHighlightIcon } from "@/lib/aboutSectionIcons";

/**
 * "Notre histoire" -- entirely tenant-authored (Admin > Paramètres > Notre
 * histoire, see AboutSectionCard), never hardcoded for any one restaurant.
 * `about` is the raw `settings.about_section` jsonb straight from
 * get_public_menu; every field is optional and this component renders
 * nothing (not even the <section>) unless the section is actually enabled
 * and both required fields (title, description) are non-empty -- an empty
 * config must never produce an empty visual block.
 *
 * `restaurant` only needs the 3 fields actually used below (deliberately
 * not the full PublicRestaurant) so the exact same component can render
 * the Admin's live preview from a DbRestaurant without reshaping it.
 *
 * `previewLayout` is Admin-preview-only: the real storefront never passes
 * it, so it keeps responding to the actual viewport via the `md:` classes
 * below exactly as before. The Admin preview panel forces a specific
 * layout instead, because its device tabs simulate a viewport width inside
 * a fixed-size admin page rather than actually resizing the browser.
 */
export function TenantAboutSection({
  restaurant,
  about,
  previewLayout,
}: {
  restaurant: { name: string; logo_url: string | null; cover_url: string | null };
  about: AboutSection | null | undefined;
  previewLayout?: "mobile" | "wide";
}) {
  const title = about?.title?.trim();
  const description = about?.description?.trim();
  if (!about || about.enabled === false || !title || !description) return null;
  const isWide = previewLayout ? previewLayout === "wide" : undefined;

  // Photo of the chef/founder/team/restaurant if the tenant uploaded one,
  // otherwise the restaurant's own existing cover/logo -- never a stock or
  // fabricated image, and no image block at all if neither exists.
  const imageUrl = about.main_image_url || restaurant.cover_url || restaurant.logo_url || null;
  const eyebrow = about.eyebrow?.trim();
  const secondaryDescription = about.secondary_description?.trim();
  const signature = about.signature?.trim();
  const ctaLabel = about.cta_label?.trim();
  const chefName = about.chef_name?.trim();
  const chefRole = about.chef_role?.trim();
  const chefMessage = about.chef_message?.trim();
  const highlights = (about.highlights ?? []).filter((h) => h.title?.trim()).slice(0, 4);

  return (
    <section id="notre-histoire" className="bg-[#FAF8F4] py-16 md:py-24">
      {/* Single grid, no order-* overrides -- the image is the first DOM
          child, which is already "image left" in the 2-col desktop grid
          and "image first, content second" once it stacks to one column
          on mobile, so both required layouts fall out of the same markup. */}
      <div
        className={`mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 ${
          isWide === undefined
            ? "md:grid-cols-2 md:items-center md:gap-16"
            : isWide
              ? "grid-cols-2 items-center gap-16"
              : ""
        }`}
      >
        {imageUrl && (
          <div className="overflow-hidden rounded-[24px] bg-muted">
            <img
              src={imageUrl}
              alt={chefName || restaurant.name}
              className="aspect-[4/5] w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div>
          {eyebrow && (
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#E87524]">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-3 font-display text-3xl font-semibold text-[#24352D] sm:text-4xl md:text-5xl">
            {title}
          </h2>
          <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-[#66736C]">
            {description}
          </p>
          {secondaryDescription && (
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-[#66736C]">
              {secondaryDescription}
            </p>
          )}

          {(chefMessage || chefName) && (
            <div className="mt-8 border-l-2 border-[#1F6B4F] pl-5">
              {chefMessage && (
                <p className="italic leading-relaxed text-[#24352D]">&ldquo;{chefMessage}&rdquo;</p>
              )}
              {chefName && (
                <p className="mt-3 text-sm font-semibold text-[#24352D]">
                  {chefName}
                  {chefRole && (
                    <span className="ml-2 font-normal text-[#66736C]">&middot; {chefRole}</span>
                  )}
                </p>
              )}
            </div>
          )}

          {highlights.length > 0 && (
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {highlights.map((highlight, index) => {
                const Icon = resolveAboutHighlightIcon(highlight.icon);
                const highlightDescription = highlight.description?.trim();
                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-[24px] border border-[rgba(31,107,79,0.15)] p-4"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[rgba(31,107,79,0.10)]">
                      <Icon className="h-[18px] w-[18px] text-[#1F6B4F]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#24352D]">{highlight.title}</p>
                      {highlightDescription && (
                        <p className="text-xs text-[#66736C]">{highlightDescription}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {ctaLabel && (
            <a
              href="#carte"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#E87524] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </a>
          )}

          {signature && <p className="mt-6 font-display text-lg text-[#24352D]">{signature}</p>}
        </div>
      </div>
    </section>
  );
}
