"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { NAV_SECTIONS, isNavItemActive } from "./nav-items";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "sidebar-collapsed";

export function AppSidebar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const { can, loading } = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // localStorage доступен только после маунта — иначе SSR/CSR разъедутся
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
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

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_SECTIONS.map((section, i) => {
          const items = section.items.filter(
            (item) => !item.permission || can(item.permission)
          );
          if (!items.length || (section.key && loading)) return null;
          return (
            <div key={section.key ?? i} className="flex flex-col gap-1">
              {section.key && !collapsed && (
                <span className="mt-4 mb-1 px-3 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
                  {t(section.key)}
                </span>
              )}
              {section.key && collapsed && (
                <div className="my-3 h-px bg-border" />
              )}
              {items.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    title={collapsed ? t(item.key) : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-200",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-accent-light text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4.5 shrink-0" />
                    {!collapsed && <span className="truncate">{t(item.key)}</span>}
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
      </div>
    </aside>
  );
}
