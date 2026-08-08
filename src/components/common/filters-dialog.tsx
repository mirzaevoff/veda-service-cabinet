"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ActiveFilter {
  /** Стабильный ключ фильтра (для сброса) */
  key: string;
  /** Готовая подпись: «Статус: Открыт» */
  label: string;
  onRemove: () => void;
}

/**
 * Кнопка «Фильтры» с числом активных + модалка со всеми контролами.
 * Фильтры применяются сразу при изменении, поэтому в футере только
 * «Сбросить» и «Готово» — отдельного «Применить» нет намеренно.
 */
export function FiltersDialog({
  active,
  onReset,
  children,
}: {
  active: ActiveFilter[];
  onReset: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("Common.filters");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn("gap-2", active.length > 0 && "border-primary/50 text-primary")}
      >
        <SlidersHorizontal className="size-4" />
        {t("button")}
        {active.length > 0 && (
          <Badge
            variant="secondary"
            className="bg-accent-light px-1.5 text-primary tabular-nums"
          >
            {active.length}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("hint")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">{children}</div>

          <DialogFooter>
            <Button
              variant="ghost"
              disabled={active.length === 0}
              onClick={onReset}
            >
              {t("reset")}
            </Button>
            <Button onClick={() => setOpen(false)}>{t("done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Чипы активных фильтров — видно, что список сужен, без открытия модалки */
export function ActiveFilterChips({ active }: { active: ActiveFilter[] }) {
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 duration-300 animate-in fade-in">
      {active.map((filter) => (
        <span
          key={filter.key}
          className="flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-xs text-muted-foreground"
        >
          {filter.label}
          <button
            type="button"
            onClick={filter.onRemove}
            aria-label={filter.label}
            className="flex size-4 items-center justify-center rounded-full transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
