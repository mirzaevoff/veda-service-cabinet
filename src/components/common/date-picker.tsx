"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { CalendarIcon, X } from "lucide-react";
import { enUS, ru, uz } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DAY_PICKER_LOCALES = { ru, uz, en: enUS } as const;

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  id,
}: {
  /** YYYY-MM-DD или пустая строка */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  id?: string;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            className={cn(
              "h-8 justify-start gap-2 rounded-lg border-input bg-transparent px-2.5 font-normal text-foreground hover:bg-secondary",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            {selected
              ? new Intl.DateTimeFormat(locale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(selected)
              : placeholder}
            {value && (
              <span
                role="button"
                tabIndex={-1}
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
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date(1990, 0)}
          captionLayout="dropdown"
          startMonth={new Date(1930, 0)}
          endMonth={new Date()}
          disabled={{ after: new Date() }}
          locale={DAY_PICKER_LOCALES[locale as keyof typeof DAY_PICKER_LOCALES] ?? ru}
          onSelect={(date) => {
            onChange(date ? toIso(date) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
