"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { NAV_SECTIONS, isNavItemActive, isNavItemVisible } from "./nav-items";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const { can } = useCurrentUser();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={t("menu")}
          >
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-brand text-base font-semibold text-primary">
            Veda Service
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 overflow-y-auto p-3">
          {NAV_SECTIONS.map((section, i) => {
            const items = section.items.filter((item) =>
              isNavItemVisible(item, can)
            );
            if (!items.length) return null;
            return (
              <div key={section.key ?? i} className="flex flex-col gap-0.5">
                {section.key && (
                  <span className="mt-3 mb-1 px-3 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
                    {t(section.key)}
                  </span>
                )}
                {items.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  if (item.disabled) {
                    return (
                      <div
                        key={item.key}
                        aria-disabled
                        className="flex h-10 cursor-not-allowed items-center gap-2.5 rounded-md px-3 text-sm font-medium text-muted-foreground/50"
                      >
                        <item.icon className="size-4.5 shrink-0" />
                        {t(item.key)}
                        <span className="ms-auto shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[0.6rem] font-medium tracking-wide text-muted-foreground/70">
                          {t("inDevelopment")}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-accent-light text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0" />
                      {t(item.key)}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
