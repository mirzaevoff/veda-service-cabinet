"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { NAV_SECTIONS, isNavItemActive, isNavItemVisible } from "./nav-items";
import { useUnreadTickets } from "@/hooks/use-unread-tickets";
import { Link, usePathname } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { version } from "../../../package.json";

const COLLAPSE_KEY = "sidebar-collapsed";
const GROUPS_KEY = "sidebar-collapsed-groups";

export function AppSidebar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const { can, loading } = useCurrentUser();
  const unread = useUnreadTickets();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [apiVersion, setApiVersion] = useState<string | null>(null);

  useEffect(() => {
    // localStorage доступен только после маунта — иначе SSR/CSR разъедутся
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      if (raw) setCollapsedGroups(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* игнор */
    }
    setHydrated(true);
    api
      .info()
      .then((info) => setApiVersion(info.version))
      .catch(() => {});
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        /* игнор */
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-border bg-sidebar md:flex",
        hydrated && "transition-[width] duration-250",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-border",
          collapsed ? "justify-center px-0" : "px-5"
        )}
      >
        <Link
          href="/"
          className="font-brand text-base font-semibold text-primary"
        >
          {collapsed ? "V" : "Veda Service"}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV_SECTIONS.map((section, i) => {
          const items = section.items.filter((item) =>
            isNavItemVisible(item, can)
          );
          if (!items.length || (section.key && loading)) return null;
          const activeGroup = items.some((item) =>
            isNavItemActive(pathname, item.href)
          );
          // Активную группу всегда показываем раскрытой
          const groupCollapsed =
            !!section.key && collapsedGroups.has(section.key) && !activeGroup;
          return (
            <div key={section.key ?? i} className="flex flex-col gap-0.5">
              {section.key && !collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(section.key!)}
                  className="mt-3 mb-1 flex items-center gap-1 px-3 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronDown
                    className={cn(
                      "size-3 transition-transform",
                      groupCollapsed && "-rotate-90"
                    )}
                  />
                  {t(section.key)}
                </button>
              )}
              {section.key && collapsed && (
                <div className="my-3 h-px bg-border" />
              )}
              {!groupCollapsed && items.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                if (item.disabled) {
                  return (
                    <div
                      key={item.key}
                      title={collapsed ? t(item.key) : t("inDevelopment")}
                      aria-disabled
                      className={cn(
                        "flex h-9 cursor-not-allowed items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground/50",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="whitespace-nowrap">{t(item.key)}</span>
                          <span className="ms-auto shrink-0 whitespace-nowrap rounded-full bg-secondary px-1.5 py-0.5 text-[0.55rem] font-medium text-muted-foreground/70">
                            {t("inDevelopment")}
                          </span>
                        </>
                      )}
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    title={collapsed ? t(item.key) : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors duration-200",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-accent-light text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4.5 shrink-0" />
                    {!collapsed && <span className="truncate">{t(item.key)}</span>}
                    {item.key === "tickets" && unread > 0 && !collapsed && (
                      <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.7rem] font-semibold text-primary-foreground tabular-nums">
                        {unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-border p-3", collapsed && "px-1.5")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={toggle}
          aria-label={t(collapsed ? "expand" : "collapse")}
          className={cn(
            "text-muted-foreground",
            !collapsed && "w-full justify-start gap-3 px-3"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4.5" />
          ) : (
            <>
              <PanelLeftClose className="size-4.5" />
              {t("collapse")}
            </>
          )}
        </Button>
        {!collapsed && (
          <div className="mt-1 px-3 pb-1 text-[0.7rem] leading-4 text-muted-foreground/70 tabular-nums">
            <span className="block truncate">Veda Service v{version}</span>
            {apiVersion && <span className="block truncate">API v{apiVersion}</span>}
          </div>
        )}
      </div>
    </aside>
  );
}
