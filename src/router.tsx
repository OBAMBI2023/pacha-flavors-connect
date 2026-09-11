import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // PHASE 7B (Report-Only CSP test, temporary): getGlobalStartContext() is a
  // no-op returning undefined on the client (compiled out by the Start
  // plugin), and on the server returns the context merged by src/start.ts's
  // requestMiddleware -- including the per-request nonce set there.
  const nonce = (getGlobalStartContext() as { cspNonce?: string } | undefined)?.cspNonce;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });

  return router;
};
