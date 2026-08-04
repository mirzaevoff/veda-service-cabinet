import {
  FolderTree,
  LayoutDashboard,
  ShieldCheck,
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
}

export interface NavSection {
  /** Ключ заголовка секции в Nav (undefined — без заголовка) */
  key?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { key: "dashboard", href: "/", icon: LayoutDashboard },
      { key: "tickets", href: "/tickets", icon: Ticket },
    ],
  },
  {
    key: "admin",
    items: [
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
        key: "categories",
        href: "/admin/categories",
        icon: FolderTree,
        permission: PERMISSIONS.ticketsCategoriesManage,
      },
    ],
  },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
