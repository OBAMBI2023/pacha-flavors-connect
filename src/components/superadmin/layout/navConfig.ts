import {
  BarChart3,
  Clock,
  Compass,
  Globe,
  Globe2,
  LayoutGrid,
  Map,
  Megaphone,
  Radio,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type SuperAdminNavItem = {
  label: string;
  icon: LucideIcon;
  /** Route pathname. Items without `to` are prepared destinations, not yet built (rendered as "Bientôt"). */
  to?: string;
  /** Anchor within `/super-admin` (existing sections rendered on the index page). */
  hash?: string;
};

export type SuperAdminNavGroup = {
  label: string;
  items: SuperAdminNavItem[];
};

/**
 * Full Super Admin navigation. Every `to`/`hash` below points at a route
 * confirmed to exist (see src/routeTree.gen.ts) -- no destination is
 * invented. "Abonnements" (platform-level), "SAOVIA GPT" and "Permissions"
 * were never built (no `to`, would render as "Bientôt") -- they are
 * intentionally omitted rather than added as dead placeholders.
 */
export const SUPER_ADMIN_NAV: SuperAdminNavGroup[] = [
  {
    label: "Accueil",
    items: [{ label: "Vue d'ensemble", icon: LayoutGrid, to: "/super-admin", hash: "overview" }],
  },
  {
    label: "Opérations",
    items: [
      { label: "Commandes", icon: ShoppingBag, to: "/super-admin/commandes" },
      { label: "Carte opérationnelle", icon: Map, to: "/super-admin/carte-operationnelle" },
      { label: "Disponibilité", icon: Clock, to: "/super-admin/availability" },
    ],
  },
  {
    label: "Réseau",
    items: [
      { label: "Tenants", icon: Store, to: "/super-admin", hash: "tenants" },
      { label: "Clients", icon: Users, to: "/super-admin/customer-map" },
      { label: "Zones & opportunités", icon: Compass, to: "/super-admin/zones-opportunites" },
    ],
  },
  {
    label: "Croissance",
    items: [
      { label: "Marketing", icon: Megaphone, to: "/super-admin/marketing" },
      { label: "Acquisition", icon: Target, to: "/super-admin/acquisition" },
    ],
  },
  {
    label: "Pilotage",
    items: [
      { label: "Statistiques", icon: BarChart3, to: "/super-admin/analytics" },
      { label: "Revenus", icon: Wallet, to: "/super-admin/revenus" },
      { label: "Live", icon: Radio, to: "/super-admin/live" },
    ],
  },
  {
    label: "Sécurité",
    items: [
      { label: "Avis & signalements", icon: Star, to: "/super-admin", hash: "avis" },
      { label: "Sécurité", icon: ShieldCheck, to: "/super-admin", hash: "securite" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { label: "Paramètres", icon: Settings, to: "/super-admin", hash: "platform-settings" },
      { label: "Domaines", icon: Globe, to: "/super-admin/domains" },
      { label: "Maps", icon: Globe2, to: "/super-admin/maps" },
    ],
  },
];

/** Flat list, used to resolve the active page title from the current location. */
export const SUPER_ADMIN_NAV_FLAT: SuperAdminNavItem[] = SUPER_ADMIN_NAV.flatMap((g) => g.items);
