import type { SuperAdminNavItem } from "./navConfig";

/** Whether `item` should render as the active destination for the current pathname/hash. */
export function isSuperAdminNavItemActive(
  item: SuperAdminNavItem,
  pathname: string,
  hash: string,
): boolean {
  if (!item.to) return false;

  if (item.to === "/super-admin") {
    if (
      pathname === "/super-admin/restaurants" ||
      pathname.startsWith("/super-admin/restaurants/")
    ) {
      return item.hash === "tenants";
    }
    if (pathname !== "/super-admin") return false;
    return (hash || "overview") === item.hash;
  }

  if (item.to === "/super-admin/marketing") return pathname.startsWith("/super-admin/marketing");

  return pathname === item.to;
}

/** Label of the nav item matching the current location, for the header's page title. */
export function resolveSuperAdminPageTitle(
  flatItems: SuperAdminNavItem[],
  pathname: string,
  hash: string,
): string {
  if (pathname.startsWith("/super-admin/restaurants/")) return "Fiche tenant";
  const match = flatItems.find((item) => isSuperAdminNavItemActive(item, pathname, hash));
  return match?.label ?? "Super Admin";
}
