import { LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SuperAdminNavList } from "./SuperAdminNavList";

export function SuperAdminMobileNav({
  open,
  onOpenChange,
  pathname,
  hash,
  email,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  hash: string;
  email: string;
  onLogout: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[85%] max-w-xs flex-col gap-0 overflow-y-auto border-none bg-[color:var(--sa-navy)] p-0 text-slate-100 [&>button]:text-slate-300 [&>button]:hover:bg-white/10"
      >
        <SheetHeader className="px-5 pb-2 pt-6 text-left">
          <SheetTitle className="flex items-center gap-2.5 text-lg font-semibold text-white">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--sa-blue)] text-sm font-bold text-white">
              S
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">SAOVIA</span>
              <span className="text-[0.7rem] font-medium text-slate-400">Super Admin</span>
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 px-3 pb-4 pt-2">
          <SuperAdminNavList
            pathname={pathname}
            hash={hash}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
        <div className="space-y-1 border-t border-white/5 p-3">
          <p className="truncate px-3.5 py-1 text-xs text-slate-500">{email}</p>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Se déconnecter
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
