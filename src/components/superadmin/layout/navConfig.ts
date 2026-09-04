import {
  BarChart3,
  Bike,
  Compass,
  CreditCard,
  Globe,
  Globe2,
  LayoutGrid,
  Lock,
  Map,
  Megaphone,
  Radio,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Target,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type SuperAdminNavItem = {
  label: string;
  icon: LucideIcon;
  /** Route pathname. Items without `to` are prepared destinations, not yet built. */
  to?: string;
  /** Anchor within `/super-admin` (existing sections rendered on the index page). */
  hash?: string;
};

export type SuperAdminNavGroup = {
  label: string;
  items: SuperAdminNavItem[];
};

export const SUPER_ADMIN_NAV: SuperAdminNavGroup[] = [
  {
    label: "Accueil",
    items: [{ label: "Vue d'ensemble", icon: LayoutGrid, to: "/super-admin", hash: "overview" }],
  },
  {
    label: "Opérations",
    items: [
      { label: "Commandes", icon: ShoppingBag, to: "/super-admin/commandes" },
      { label: "Livraisons", icon: Truck, to: "/super-admin", hash: "dispatch" },
      { label: "Livreurs", icon: Bike, to: "/super-admin", hash: "livreurs" },
      { label: "Carte opérationnelle", icon: Map, to: "/super-admin/carte-operationnelle" },
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
      { label: "Live", icon: Radio, to: "/super-admin/live" },
      { label: "Abonnements", icon: CreditCard },
      { label: "Revenus", icon: Wallet, to: "/super-admin/revenus" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Analytics", icon: BarChart3, to: "/super-admin/analytics" },
      { label: "SAOVIA GPT", icon: Sparkles },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Avis & signalements", icon: Star, to: "/super-admin", hash: "avis" },
      { label: "Domaines", icon: Globe, to: "/super-admin/domains" },
      { label: "Maps", icon: Globe2, to: "/super-admin/maps" },
      { label: "Paramètres", icon: Settings, to: "/super-admin", hash: "platform-settings" },
      { label: "Sécurité", icon: ShieldCheck, to: "/super-admin", hash: "securite" },
      { label: "Permissions", icon: Lock },
    ],
  },
];

/** Flat list, used to resolve the active page title from the current location. */
export const SUPER_ADMIN_NAV_FLAT: SuperAdminNavItem[] = SUPER_ADMIN_NAV.flatMap((g) => g.items);
