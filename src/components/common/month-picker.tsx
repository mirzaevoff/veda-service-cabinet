"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Выбор месяца (год + сетка месяцев, без чисел). value — `YYYY-MM` или "" */
export function MonthPicker({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  id?: string;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const selYear = value ? Number(value.slice(0, 4)) : null;
  const selMonth = value ? Number(value.slice(5, 7)) : null;
  const [year, setYear] = useState(selYear ?? new Date().getFullYear());

  const monthsShort = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(
      new Date(2020, i, 1)
    )
  );

  const label = value
    ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
        new Date(Number(selYear), Number(selMonth) - 1, 1)
      )
    : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setYear(selYear ?? new Date().getFullYear());
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            className={cn(
              "h-9 min-w-44 justify-start gap-2 rounded-md border-input bg-transparent px-3 font-normal text-foreground hover:bg-secondary",
              value ? "capitalize" : "text-muted-foreground"
            )}
          >
            <CalendarDays className="size-4 text-muted-foreground" />
            {label}
            {value && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="clear"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="ms-auto flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64 p-2">
        <div className="flex items-center justify-between pb-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="prev year"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="next year"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {monthsShort.map((name, i) => {
            const val = `${year}-${String(i + 1).padStart(2, "0")}`;
            const active = selYear === year && selMonth === i + 1;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onChange(val);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm capitalize transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                )}
              >
                {name.replace(/\.$/, "")}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
