import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy marketplace storefront -- superseded by /r/$slug (src/routes/r.$slug.tsx),
 * which is the actively maintained tenant storefront (correct title/description via
 * src/lib/seo.ts, absolute canonical, JSON-LD). This route was never linked from
 * anywhere in the app, had its own hand-rolled head() using the raw slug instead of
 * the restaurant's name, and a relative canonical. Permanent redirect instead of a
 * second, competing indexable page for the same tenant.
 */
export const Route = createFileRoute("/restaurant/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/r/$slug", params: { slug: params.slug }, statusCode: 301 });
  },
});
