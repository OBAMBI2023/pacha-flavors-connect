import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The SAOVIA Food B2B landing (Phase 3U) moved to "/" -- the official
 * public architecture no longer wants two indexable B2B pages (this one and
 * the homepage) competing for the same content. Permanent redirect instead
 * of a second, competing indexable page. See src/routes/index.tsx for the
 * component this used to render (FoodLandingPage, moved there verbatim).
 */
export const Route = createFileRoute("/food")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
});
