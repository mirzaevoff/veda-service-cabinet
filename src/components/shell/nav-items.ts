import {
  BookOpen,
  ChartColumn,
  ClipboardList,
  Building2,
  Handshake,
  Store,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  Package,
  ArrowLeftRight,
  ReceiptText,
  ScrollText,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions";

export interface NavItem {
  /** Ключ перевода в namespace Nav */
  key: string;
  href: string;
  icon: LucideIcon;
  /** Пункт виден только при этом праве */
  permission?: string;
  /** Пункт виден при ЛЮБОМ из этих прав */
  anyPermission?: string[];
  /** Заглушка: показывается, но не кликается (в разработке) */
  disabled?: boolean;
}

export interface NavSection {
  /** Ключ заголовка секции в Nav (undefined — без заголовка) */
  key?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ key: "dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    key: "main",
    items: [
      {
        key: "venues",
        href: "/venues",
        icon: Store,
        permission: PERMISSIONS.venuesView,
      },
      { key: "legalEntities", href: "/legal-entities", icon: Building2 },
      {
        key: "products",
        href: "/products",
        icon: Package,
        permission: PERMISSIONS.productsList,
      },
    ],
  },
  {
    key: "services",
    items: [
      { key: "checklists", href: "/checklists", icon: ListChecks },
      {
        key: "iikoPartner",
        href: "/iiko-partner",
        icon: Handshake,
        anyPermission: [
          PERMISSIONS.iikoPartnerView,
          PERMISSIONS.iikoInvoicesView,
          PERMISSIONS.iikoPartnerInvoicesView,
        ],
      },
    ],
  },
  {
    key: "finance",
    items: [
      {
        key: "bank",
        href: "/admin/bank",
        icon: Landmark,
        permission: PERMISSIONS.bankView,
      },
      {
        key: "transactions",
        href: "/transactions",
        icon: ArrowLeftRight,
        permission: PERMISSIONS.balancesView,
      },
      {
        key: "invoices",
        href: "/invoices",
        icon: ReceiptText,
        permission: PERMISSIONS.invoicesView,
      },
    ],
  },
  {
    key: "admin",
    items: [
      {
        key: "panel",
        href: "/admin/panel",
        icon: SlidersHorizontal,
        anyPermission: [
          PERMISSIONS.notificationsSend,
          PERMISSIONS.settingsManage,
        ],
      },
      {
        key: "directories",
        href: "/admin/directories",
        icon: LibraryBig,
        anyPermission: [
          PERMISSIONS.rolesRead,
          PERMISSIONS.ticketsCategoriesManage,
          PERMISSIONS.locationsView,
          PERMISSIONS.equipmentView,
        ],
      },
      {
        key: "users",
        href: "/admin/users",
        icon: Users,
        permission: PERMISSIONS.usersList,
      },
      {
        key: "roles",
        href: "/admin/roles",
        icon: ShieldCheck,
        permission: PERMISSIONS.rolesRead,
      },
      {
        key: "logs",
        href: "/admin/logs",
        icon: ScrollText,
        permission: PERMISSIONS.logsView,
      },
      {
        key: "apiTokens",
        href: "/admin/api-tokens",
        icon: KeyRound,
        permission: PERMISSIONS.apiTokensManage,
      },
    ],
  },
  {
    key: "help",
    items: [
      { key: "tickets", href: "/tickets", icon: Ticket },
      {
        key: "techStats",
        href: "/tech-stats",
        icon: ChartColumn,
        permission: PERMISSIONS.ticketsList,
      },
      {
        key: "clientServers",
        href: "/client-servers",
        icon: Server,
        permission: PERMISSIONS.iikoServersView,
      },
      {
        key: "equipment",
        href: "/equipment",
        icon: Package,
        permission: PERMISSIONS.equipmentView,
      },
      {
        key: "inventory",
        href: "/inventory",
        icon: ClipboardList,
        permission: PERMISSIONS.inventoryView,
      },
      {
        key: "knowledgeBase",
        href: "/knowledge",
        icon: BookOpen,
        permission: PERMISSIONS.knowledgeView,
      },
    ],
  },
];

export function isNavItemVisible(
  item: NavItem,
  can: (permission: string) => boolean
): boolean {
  if (item.permission && !can(item.permission)) return false;
  if (item.anyPermission && !item.anyPermission.some(can)) return false;
  return true;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
