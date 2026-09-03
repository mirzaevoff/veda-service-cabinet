"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { NAV_SECTIONS, NAV_SUBITEMS, isNavItemVisible } from "./nav-items";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Командная палитра: ⌘K / Ctrl+K — быстрый переход по разделам */
export function CommandPalette() {
  const t = useTranslations("Nav");
  const tRoot = useTranslations();
  const tp = useTranslations("CommandPalette");
  const { can } = useCurrentUser();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const items = useMemo(() => {
    const main = NAV_SECTIONS.flatMap((s) =>
      s.items
        .filter((it) => !it.disabled && isNavItemVisible(it, can))
        .map((it) => ({
          key: it.key,
          href: it.href,
          icon: it.icon,
          label: t(it.key),
          section: s.key,
        }))
    );
    // Вкладки хабов (бывшие разделы) — тоже находимы в ⌘K
    const subs = NAV_SUBITEMS.filter((it) => isNavItemVisible(it, can)).map(
      (it) => ({
        key: it.key,
        href: it.href,
        icon: it.icon,
        label: tRoot(it.labelKey),
        section: it.sectionKey,
      })
    );
    return [...main, ...subs];
  }, [can, t, tRoot]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((it) => it.label.toLowerCase().includes(query));
  }, [items, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при открытии
      setQ("");
      setIdx(0);
    }
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={tp("open")}
        title={tp("open")}
        onClick={() => setOpen(true)}
      >
        <Search className="size-4.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">{tp("title")}</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-3.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setIdx(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIdx((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIdx((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && filtered[idx]) {
                  e.preventDefault();
                  go(filtered[idx].href);
                }
              }}
              placeholder={tp("placeholder")}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {tp("empty")}
              </p>
            ) : (
              filtered.map((it, i) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => go(it.href)}
                  onMouseMove={() => setIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    i === idx ? "bg-secondary text-foreground" : "text-muted-foreground"
                  )}
                >
                  <it.icon className="size-4 shrink-0" />
                  <span className="text-foreground">{it.label}</span>
                  {it.section && (
                    <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                      {t(it.section)}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
