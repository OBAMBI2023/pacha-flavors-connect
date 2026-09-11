import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// PHASE 7B (Report-Only CSP test, temporary): one nonce per request, handed
// to src/router.tsx (via getGlobalStartContext) so TanStack Router stamps it
// on every SSR-rendered <script>/<style>/<link>, and reused here to build the
// matching Content-Security-Policy-Report-Only header. Web Crypto (not
// node:crypto) so this stays safe to reference from an isomorphic file.
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

const SUPABASE_ORIGIN = "https://haamomdggdubdzsmbwoq.supabase.co";

function buildReportOnlyCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    `img-src 'self' data: ${SUPABASE_ORIGIN} https://tiles.openfreemap.org`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${SUPABASE_ORIGIN} wss://${new URL(SUPABASE_ORIGIN).host} https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://cloudflare-dns.com`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src https://www.google.com",
    // Local-test placeholder only -- production needs host-aware logic
    // (Lovable preview/editor origins vs. tenant custom domains), not coded
    // yet per Phase 7B §5.
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// Outermost middleware: wraps the whole request so the nonce it generates is
// visible to every downstream middleware/route/router-creation call via
// getGlobalStartContext(), and so it can still set a header on the final
// Response after everything else (errorMiddleware included) has run.
const securityHeadersMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  const nonce = generateNonce();
  const result = await next({ context: { cspNonce: nonce } });
  if (handlerType === "router" && result.response instanceof Response) {
    result.response.headers.set("Content-Security-Policy-Report-Only", buildReportOnlyCsp(nonce));
  }
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware, csrfMiddleware],
}));
