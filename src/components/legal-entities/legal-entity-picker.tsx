"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { LegalEntity } from "@/lib/api";
import { legalEntitiesApi } from "@/lib/api-authed";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

export type PickedEntity = { id: string; name: string };

/**
 * Комбобокс выбора ЮЛ с серверным поиском (название/ИНН). Для экранов, где
 * список ЮЛ заранее не загружен (привязка Telegram-группы и т.п.).
 */
export function LegalEntityPicker({
  value,
  onChange,
  placeholder,
  className,
  align = "start",
}: {
  value: PickedEntity | null;
  onChange: (entity: PickedEntity) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "end";
}) {
  const tc = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350);
  const [options, setOptions] = useState<LegalEntity[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- индикатор загрузки перед запросом
    setOptions(null);
    legalEntitiesApi
      .list({ search: debounced || undefined, limit: 20 })
      .then((page) => !cancelled && setOptions(page.items))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

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
            size="sm"
            className={cn("justify-between gap-2 font-normal", className)}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {value?.name || placeholder || tc("select")}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align={align} className="w-80 max-w-[92vw] p-2">
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
          {!options ? (
            <div className="flex justify-center py-5">
              <Spinner className="size-4" />
            </div>
          ) : options.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {tc("nothingFound")}
            </p>
          ) : (
            options.map((e) => {
              const selected = value?.id === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onChange({ id: e.id, name: e.name });
                    setOpen(false);
                    setQ("");
                  }}
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
                    <span
                      className={cn(
                        "truncate",
                        selected && "font-medium text-primary"
                      )}
                    >
                      {e.name}
                    </span>
                    <span className="truncate text-xs tabular-nums text-muted-foreground">
                      {e.taxId}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
