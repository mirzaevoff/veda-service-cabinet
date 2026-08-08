"use client";

import { useTranslations } from "next-intl";
import { ArrowDownUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortValue } from "./sortable-table-head";

export interface SortOption {
  /** Значение в формате API: "scheduledAt:desc" */
  value: SortValue;
  label: string;
}

/** Сортировка для списков без табличных заголовков (карточки) */
export function SortSelect({
  value,
  options,
  onChange,
  className = "w-52",
}: {
  value: SortValue;
  options: SortOption[];
  onChange: (next: SortValue) => void;
  className?: string;
}) {
  const t = useTranslations("Common");
  return (
    <Select
      value={value}
      items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
      onValueChange={(v) => onChange(v as SortValue)}
    >
      <SelectTrigger className={className} aria-label={t("sort")}>
        <ArrowDownUp className="size-4 shrink-0 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
