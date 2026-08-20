import { Link } from "@tanstack/react-router";
import { RotateCcw, Store, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function TenantStorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-cocoa-foreground/10 bg-cocoa">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full bg-cocoa-foreground/10 sm:h-14 sm:w-14 md:h-16 md:w-16 lg:h-[4.5rem] lg:w-[4.5rem]" />
            <Skeleton className="h-6 w-40 bg-cocoa-foreground/10" />
          </div>
          <Skeleton className="h-11 w-11 rounded-full bg-cocoa-foreground/10" />
        </div>
      </div>
      <Skeleton className="min-h-[520px] w-full rounded-none bg-cocoa/60 md:min-h-[600px]" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TenantNotFoundState() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <Store className="h-10 w-10 text-muted-foreground/50" />
      <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Restaurant introuvable</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Ce restaurant n'existe pas ou n'est pas disponible publiquement pour le moment.
      </p>
      <Link to="/" className="mt-6 text-sm font-semibold text-primary underline underline-offset-4">
        Retour à l'accueil
      </Link>
    </main>
  );
}

export function TenantErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <TriangleAlert className="h-10 w-10 text-destructive/70" />
      <h1 className="mt-4 font-display text-3xl font-semibold">Une erreur est survenue</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Impossible de charger ce restaurant pour le moment. Vérifiez votre connexion et réessayez.
      </p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <RotateCcw className="h-4 w-4" /> Réessayer
      </button>
    </main>
  );
}

export function TenantEmptyMenuState() {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <UtensilsCrossed className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        Ce restaurant n'a pas encore publié de carte. Revenez bientôt.
      </p>
    </div>
  );
}
