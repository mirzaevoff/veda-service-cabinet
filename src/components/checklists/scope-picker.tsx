"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { LegalEntity } from "@/lib/api";
import { cn } from "@/lib/utils";

const nameOf = (e: LegalEntity) => e.establishment || e.name;

/**
 * Выбор области чеклистов: «Личные» + список ЮЛ, с поиском по названию/ИНН.
 * Список уже загружен на странице — фильтруем на клиенте.
 */
export function ScopePicker({
  value,
  onChange,
  entities,
  personalLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  entities: LegalEntity[];
  personalLabel: string;
  className?: string;
}) {
  const tc = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const label =
    value === "personal"
      ? personalLabel
      : (entities.find((e) => e.id === value)
          ? nameOf(entities.find((e) => e.id === value)!)
          : personalLabel);

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      entities.filter(
        (e) =>
          !query ||
          nameOf(e).toLowerCase().includes(query) ||
          e.name.toLowerCase().includes(query) ||
          (e.taxId ?? "").toLowerCase().includes(query)
      ),
    [entities, query]
  );

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQ("");
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn("w-56 justify-between gap-2 font-normal", className)}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 max-w-[92vw] p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tc("search")}
            className="h-8 pl-8"
          />
        </div>
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {(!query || personalLabel.toLowerCase().includes(query)) && (
            <ScopeRow
              label={personalLabel}
              selected={value === "personal"}
              onClick={() => pick("personal")}
            />
          )}
          {filtered.map((e) => (
            <ScopeRow
              key={e.id}
              label={nameOf(e)}
              subtitle={e.taxId}
              selected={value === e.id}
              onClick={() => pick(e.id)}
            />
          ))}
          {filtered.length === 0 &&
            !(!query || personalLabel.toLowerCase().includes(query)) && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {tc("nothingFound")}
              </p>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ScopeRow({
  label,
  subtitle,
  selected,
  onClick,
}: {
  label: string;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary",
        selected && "bg-accent-light"
      )}
    >
      <Check
        className={cn(
          "size-4 shrink-0",
          selected ? "text-primary" : "text-transparent"
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate", selected && "font-medium text-primary")}>
          {label}
        </span>
        {subtitle && (
          <span className="truncate text-xs tabular-nums text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}
