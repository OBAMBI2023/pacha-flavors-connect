import { ChevronLeft } from "lucide-react";

/** Top bar for a screen pushed from a secondary entry point (header icons, Accueil/Profil links) rather than a persistent bottom tab -- these screens hide DriverBottomNav and use this instead of it, mirroring a native "push" screen. */
export function SecondaryScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Retour"
        onClick={onBack}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-sm"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
    </div>
  );
}
