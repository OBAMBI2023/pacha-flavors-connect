import { useEffect, useState } from "react";
import type { PublicRestaurant } from "@/lib/menu-db";

// Matches the recommended cover upload dimensions (see the admin "Cover" field
// helper text). Used only until the real image loads and reports its own ratio.
const DEFAULT_COVER_RATIO = 1920 / 900;

export function TenantHero({ restaurant }: { restaurant: PublicRestaurant }) {
  const [coverFailed, setCoverFailed] = useState(false);
  // Tracks the cover's real width/height so the container's aspect-ratio can
  // match it exactly -- this is what avoids cropping any part of the banner,
  // regardless of what ratio a given tenant's image actually is.
  const [coverRatio, setCoverRatio] = useState<number | null>(null);
  useEffect(() => {
    setCoverFailed(false);
    setCoverRatio(null);
  }, [restaurant.cover_url]);

  const hasCover = Boolean(restaurant.cover_url) && !coverFailed;

  return (
    <section id="accueil" className="bg-background pt-1">
      {/* Cover: image only -- no text, logo, badge, or gradient on top of it.
          Height is derived from the image's own ratio (not a fixed px value),
          so the full banner is always visible instead of being cropped. */}
      <div
        className={`mx-4 overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:mx-6 ${hasCover ? "" : "bg-gradient-to-br from-primary to-foreground"}`}
        style={{ aspectRatio: hasCover ? (coverRatio ?? DEFAULT_COVER_RATIO) : DEFAULT_COVER_RATIO }}
      >
        {hasCover && (
          <img
            src={restaurant.cover_url ?? undefined}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setCoverRatio(naturalWidth / naturalHeight);
              }
            }}
            onError={() => setCoverFailed(true)}
          />
        )}
      </div>
    </section>
  );
}
