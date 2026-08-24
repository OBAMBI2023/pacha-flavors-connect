import { Link } from "@tanstack/react-router";
import { useTenantNavItems } from "@/components/tenant/tenantNavItems";
import { AccountLookupModal } from "@/components/tenant/AccountLookupModal";

export function TenantBottomNav({
  restaurantSlug,
  restaurantName,
  onOpenOffers,
}: {
  restaurantSlug: string;
  restaurantName: string;
  onOpenOffers: () => void;
}) {
  const { items, accountModalOpen, closeAccountModal, submitPhone } = useTenantNavItems({ restaurantSlug, onOpenOffers });

  const itemClass = (isActive: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${isActive ? "font-bold text-primary" : "font-medium text-foreground"}`;
  const iconWrapClass = (isActive: boolean) =>
    `relative grid h-8 w-8 place-items-center rounded-full transition-colors ${isActive ? "bg-accent" : ""}`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:hidden"
      style={{ height: "calc(76px + env(safe-area-inset-bottom))" }}
    >
      <div className="flex h-[76px] items-center">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <span className={iconWrapClass(item.active)}>
                <Icon className="h-5 w-5" />
                {item.badge !== undefined && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </span>
              {item.label}
            </>
          );
          if (item.to) {
            return (
              <Link key={item.key} to={item.to} className={itemClass(item.active)}>
                {content}
              </Link>
            );
          }
          return (
            <button key={item.key} type="button" onClick={item.onClick} className={itemClass(item.active)}>
              {content}
            </button>
          );
        })}
      </div>
      {accountModalOpen && (
        <AccountLookupModal restaurantName={restaurantName} onClose={closeAccountModal} onSubmit={submitPhone} />
      )}
    </nav>
  );
}
