import { Phone, MessageCircle, ShoppingBag } from "lucide-react";
import { SITE, whatsappUrl } from "@/data/site";
import { useCart } from "@/lib/cart";

export function MobileActionBar() {
  const { count, openCart } = useCart();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-3 gap-2 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <a
          href={`tel:${SITE.phoneTel}`}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-xs font-medium"
        >
          <Phone className="h-4 w-4" /> Appeler
        </a>
        <a
          href={whatsappUrl("Bonjour LE PACHA")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-xs font-medium"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <button
          onClick={openCart}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground"
        >
          <ShoppingBag className="h-4 w-4" />
          Commander{count > 0 ? ` (${count})` : ""}
        </button>
      </div>
    </div>
  );
}