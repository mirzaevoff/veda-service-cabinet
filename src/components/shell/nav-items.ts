import {
  Building2,
  Landmark,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  Package,
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
      { key: "legalEntities", href: "/legal-entities", icon: Building2 },
      {
        key: "products",
        href: "/products",
        icon: Package,
        permission: PERMISSIONS.productsList,
      },
      { key: "checklists", href: "/checklists", icon: ListChecks },
    ],
  },
  {
    key: "admin",
    items: [
      {
        key: "directories",
        href: "/admin/directories",
        icon: LibraryBig,
        anyPermission: [
          PERMISSIONS.rolesRead,
          PERMISSIONS.ticketsCategoriesManage,
        ],
      },
      {
        key: "bank",
        href: "/admin/bank",
        icon: Landmark,
        permission: PERMISSIONS.bankView,
      },
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
        key: "users",
        href: "/admin/users",
        icon: Users,
        permission: PERMISSIONS.usersList,
      },
    ],
  },
  {
    key: "help",
    items: [{ key: "tickets", href: "/tickets", icon: Ticket }],
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
