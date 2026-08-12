"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Формат «90 123 45 67» из 9 цифр */
function formatDigits(digits: string) {
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 7),
    digits.slice(7, 9),
  ].filter(Boolean);
  return groups.join(" ");
}

export function PhoneInput({
  value,
  onChange,
  invalid,
  compact,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  /** 9 цифр без префикса +998 */
  value: string;
  onChange: (digits: string) => void;
  invalid?: boolean;
  /** Обычная высота поля — для форм и модалок (по умолчанию крупный логин-вариант) */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center rounded-md border-input bg-card transition-colors focus-within:border-primary",
        compact ? "h-9 border" : "h-[54px] border-[1.5px]",
        invalid && "border-destructive"
      )}
    >
      <span
        className={cn(
          "select-none text-foreground",
          compact ? "pl-3 text-sm" : "pl-4 text-base"
        )}
      >
        +998
      </span>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="90 123 45 67"
        value={formatDigits(value)}
        onChange={(e) => {
          let digits = e.target.value.replace(/\D/g, "");
          if (digits.startsWith("998") && digits.length > 9) {
            digits = digits.slice(3);
          }
          onChange(digits.slice(0, 9));
        }}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-full flex-1 border-0 bg-transparent pl-2 shadow-none focus-visible:border-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent",
          compact ? "!text-sm" : "!text-base"
        )}
        {...props}
      />
    </div>
  );
}
