import {
  BarChart3,
  LayoutGrid,
  MessageCircle,
  Send,
  Settings,
  Sparkles,
  Tag,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export type CrmNavItem = { label: string; icon: LucideIcon; to: string; exact?: boolean };

/** Internal navigation for the /super-admin/marketing module only -- distinct from the single "Marketing" entry in the global SuperAdminSidebar (src/components/superadmin/layout/navConfig.ts), which is untouched. */
export const CRM_NAV_ITEMS: CrmNavItem[] = [
  { label: "Dashboard", icon: LayoutGrid, to: "/super-admin/marketing", exact: true },
  { label: "Clients", icon: Users, to: "/super-admin/marketing/clients" },
  { label: "Audiences", icon: Target, to: "/super-admin/marketing/audiences" },
  { label: "WhatsApp", icon: MessageCircle, to: "/super-admin/marketing/whatsapp" },
  { label: "Campagnes", icon: Send, to: "/super-admin/marketing/campagnes" },
  { label: "Automatisations", icon: Sparkles, to: "/super-admin/marketing/automatisations" },
  { label: "Promotions", icon: Tag, to: "/super-admin/marketing/promotions" },
  { label: "Analytics", icon: BarChart3, to: "/super-admin/marketing/analytics" },
  { label: "Paramètres", icon: Settings, to: "/super-admin/marketing/parametres" },
];
