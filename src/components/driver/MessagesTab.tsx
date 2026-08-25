import { MessageCircle } from "lucide-react";

/** No driver-facing message/chat table or RPC exists anywhere in this schema -- this is an honest empty state, not a fabricated conversation list, matching the reference mockup's own "Aucun message" screen. */
export function MessagesTab() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold">Messages</h1>
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground">
          <MessageCircle className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium text-foreground">Aucun message</p>
        <p className="max-w-[220px] text-xs text-muted-foreground">La messagerie livreur n'est pas encore disponible sur cet espace.</p>
      </div>
    </>
  );
}
