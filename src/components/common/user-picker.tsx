"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { UserProfile } from "@/lib/api";
import { adminApi } from "@/lib/api-authed";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

/** Поиск и выбор пользователя (по имени/телефону) */
export function UserPicker({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: {
  value: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);
  const [options, setOptions] = useState<UserProfile[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void adminApi.users
      .list({ search: debounced || undefined, limit: 15 })
      .then((p) => !cancelled && setOptions(p.items))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              className="min-w-0 flex-1 justify-start font-normal"
            >
              <span className="truncate">{value ? value.name : placeholder}</span>
            </Button>
          }
        />
        <PopoverContent align="start" className="w-72 p-2">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search")}
              className="h-8 pl-8"
            />
          </div>
          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {options?.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange({ id: u.id, name: [u.name, u.lastName].filter(Boolean).join(" ") });
                  setOpen(false);
                }}
                className="flex flex-col rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
              >
                <span className="font-medium">
                  {[u.name, u.lastName].filter(Boolean).join(" ")}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{u.phone}</span>
              </button>
            ))}
            {options && options.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {t("nothingFound")}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value && !disabled && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("clear")}
          onClick={() => onChange(null)}
          className="shrink-0 text-muted-foreground"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
