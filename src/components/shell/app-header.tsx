"use client";

import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/common/locale-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu } from "./user-menu";
import { NAV_SECTIONS, isNavItemActive } from "./nav-items";
import { usePathname } from "@/i18n/navigation";

export function AppHeader() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const current = NAV_SECTIONS.flatMap((s) => s.items)
    .filter((item) => isNavItemActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <MobileNav />
        <h1 className="text-lg font-bold tracking-tight">
          {current ? t(current.key) : ""}
        </h1>
      </div>
      <div className="flex items-center gap-1.5">
        <CommandPalette />
        <NotificationsBell />
        <LocaleSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
