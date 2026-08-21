import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function MarketplaceShell({
  eyebrow,
  title,
  subtitle,
  searchHref,
  ctas,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  searchHref: string;
  ctas: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(185,128,61,0.18),_transparent_30%),linear-gradient(180deg,#fff8ef_0%,#fffdf9_25%,#ffffff_100%)] text-foreground">
      <header className="border-b border-border/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
            <Link to="/" className="font-display text-2xl font-semibold">
              SAOVIA
            </Link>
          </div>
          <div className="flex items-center gap-2">{ctas}</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-10">
          <div className="max-w-3xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">Marketplace</p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">{subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={searchHref as never}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                Rechercher
              </Link>
              <Link
                to="/restaurants"
                className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold"
              >
                Explorer les restaurants
              </Link>
            </div>
          </div>
        </section>
        <div className="mt-8 space-y-8">{children}</div>
      </main>
    </div>
  );
}
