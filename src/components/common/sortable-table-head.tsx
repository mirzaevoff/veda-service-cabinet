"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

/** Строка вида "name:asc" — формат, который принимает API */
export type SortValue = string;

export function parseSortValue(sort: SortValue) {
  const [field, direction] = sort.split(":");
  return { field, direction: (direction as SortDirection) ?? "asc" };
}

/**
 * Следующее состояние по клику: неактивна → asc → desc → сброс (дефолт сервера).
 */
export function nextSort(current: SortValue, field: string): SortValue {
  const parsed = parseSortValue(current);
  if (parsed.field !== field) return `${field}:asc`;
  if (parsed.direction === "asc") return `${field}:desc`;
  return "";
}

/**
 * Заголовок сортируемой колонки. `sort` — текущее значение в формате API,
 * `onSort` получает новое (пустая строка — сортировка по умолчанию).
 */
export function SortableTableHead({
  field,
  sort,
  onSort,
  align = "start",
  className,
  children,
}: {
  field: string;
  sort: SortValue;
  onSort: (next: SortValue) => void;
  align?: "start" | "end";
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Common");
  const parsed = parseSortValue(sort);
  const active = parsed.field === field;
  const Icon = !active
    ? ChevronsUpDown
    : parsed.direction === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <TableHead className={cn("p-0", className)}>
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, field))}
        aria-label={t("sortBy", { column: String(children) })}
        className={cn(
          "group flex h-10 w-full items-center gap-1.5 px-2 text-sm font-medium transition-colors hover:text-foreground",
          align === "end" ? "justify-end" : "justify-start",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {children}
        <Icon
          className={cn(
            "size-3.5 shrink-0 transition-opacity",
            active
              ? "text-primary opacity-100"
              : "opacity-0 group-hover:opacity-60"
          )}
        />
      </button>
    </TableHead>
  );
}
