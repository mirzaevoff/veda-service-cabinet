import {
  ArrowLeftRight,
  BookOpen,
  Building2,
  ChartColumn,
  ClipboardList,
  Handshake,
  KeyRound,
  Store,
  Landmark,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  Package,
  ReceiptText,
  ScrollText,
  Send,
  Server,
  Split,
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
      {
        // Хаб: Банк · Транзакции · Счета
        key: "finance",
        href: "/finance",
        icon: Landmark,
        anyPermission: [
          PERMISSIONS.bankView,
          PERMISSIONS.balancesView,
          PERMISSIONS.invoicesView,
        ],
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
    key: "help",
    items: [
      // Хаб: Заявки · Статистика
      { key: "tickets", href: "/tickets", icon: Ticket },
      {
        // Хаб: Реестр · Инвентаризация
        key: "equipment",
        href: "/equipment",
        icon: Package,
        anyPermission: [PERMISSIONS.equipmentView, PERMISSIONS.inventoryView],
      },
      {
        key: "clientServers",
        href: "/client-servers",
        icon: Server,
        permission: PERMISSIONS.iikoServersView,
      },
      {
        key: "knowledgeBase",
        href: "/knowledge",
        icon: BookOpen,
        permission: PERMISSIONS.knowledgeView,
      },
    ],
  },
  {
    key: "admin",
    items: [
      {
        // Хаб: Люди · Роли и доступы
        key: "users",
        href: "/admin/users",
        icon: Users,
        anyPermission: [PERMISSIONS.usersList, PERMISSIONS.rolesRead],
      },
      {
        key: "directories",
        href: "/admin/directories",
        icon: LibraryBig,
        anyPermission: [
          PERMISSIONS.ticketsCategoriesManage,
          PERMISSIONS.locationsView,
          PERMISSIONS.equipmentView,
        ],
      },
      {
        // Хаб: Настройки · Рассылка · Журнал · API-токены
        key: "system",
        href: "/admin/panel",
        icon: SlidersHorizontal,
        anyPermission: [
          PERMISSIONS.settingsManage,
          PERMISSIONS.notificationsSend,
          PERMISSIONS.logsView,
          PERMISSIONS.apiTokensManage,
        ],
      },
    ],
  },
];

/** Пункт-вкладка внутри хаба — для поиска ⌘K (в сайдбаре не показывается) */
export interface NavSubItem {
  key: string;
  href: string;
  icon: LucideIcon;
  /** Полный путь i18n для подписи (вне namespace Nav) */
  labelKey: string;
  /** Ключ секции-родителя (namespace Nav) для правой подписи */
  sectionKey: string;
  permission?: string;
  anyPermission?: string[];
}

/** Вкладки хабов, findable через ⌘K (переехавшие бывшие разделы) */
export const NAV_SUBITEMS: NavSubItem[] = [
  {
    key: "finance-transactions",
    href: "/finance?tab=transactions",
    icon: ArrowLeftRight,
    labelKey: "Finance.tabs.transactions",
    sectionKey: "finance",
    permission: PERMISSIONS.balancesView,
  },
  {
    key: "finance-invoices",
    href: "/finance?tab=invoices",
    icon: ReceiptText,
    labelKey: "Finance.tabs.invoices",
    sectionKey: "finance",
    permission: PERMISSIONS.invoicesView,
  },
  {
    key: "finance-bank",
    href: "/finance?tab=bank",
    icon: Landmark,
    labelKey: "Finance.tabs.bank",
    sectionKey: "finance",
    permission: PERMISSIONS.bankView,
  },
  {
    key: "finance-chainSplit",
    href: "/finance?tab=chainSplit",
    icon: Split,
    labelKey: "Finance.tabs.chainSplit",
    sectionKey: "finance",
    permission: PERMISSIONS.iikoInvoicesView,
  },
  {
    key: "tickets-stats",
    href: "/tickets?tab=stats",
    icon: ChartColumn,
    labelKey: "Tickets.tabs.stats",
    sectionKey: "help",
    permission: PERMISSIONS.ticketsList,
  },
  {
    key: "equipment-inventory",
    href: "/equipment?tab=inventory",
    icon: ClipboardList,
    labelKey: "Equipment.tabs.inventory",
    sectionKey: "help",
    permission: PERMISSIONS.inventoryView,
  },
  {
    key: "users-roles",
    href: "/admin/users?tab=roles",
    icon: ShieldCheck,
    labelKey: "AdminUsers.tabs.roles",
    sectionKey: "admin",
    permission: PERMISSIONS.rolesRead,
  },
  {
    key: "system-settings",
    href: "/admin/panel?tab=settings",
    icon: SlidersHorizontal,
    labelKey: "AdminSystem.tabs.settings",
    sectionKey: "admin",
    permission: PERMISSIONS.settingsManage,
  },
  {
    key: "system-broadcast",
    href: "/admin/panel?tab=broadcast",
    icon: Send,
    labelKey: "AdminSystem.tabs.broadcast",
    sectionKey: "admin",
    permission: PERMISSIONS.notificationsSend,
  },
  {
    key: "system-logs",
    href: "/admin/panel?tab=logs",
    icon: ScrollText,
    labelKey: "AdminSystem.tabs.logs",
    sectionKey: "admin",
    permission: PERMISSIONS.logsView,
  },
  {
    key: "system-apiTokens",
    href: "/admin/panel?tab=apiTokens",
    icon: KeyRound,
    labelKey: "AdminSystem.tabs.apiTokens",
    sectionKey: "admin",
    permission: PERMISSIONS.apiTokensManage,
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
