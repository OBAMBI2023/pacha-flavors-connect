import { Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";

export function TopBar({ backTo = "/" }: { backTo?: string }) {
  return (
    <div className="flex h-[4.5rem] items-center justify-between gap-3 px-4">
      <Link
        to={backTo as never}
        aria-label="Retour"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground"
      >
        <ArrowLeft className="h-6 w-6" />
      </Link>
      <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5 text-sm font-semibold">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">Abidjan, Côte d'Ivoire</span>
      </div>
      <div className="w-11 shrink-0" aria-hidden />
    </div>
  );
}
