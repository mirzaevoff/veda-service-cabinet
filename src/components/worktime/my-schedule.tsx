"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { MonthPicker } from "@/components/common/month-picker";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShiftAssignment } from "@/lib/api";
import { SessionExpiredError, worktimeApi } from "@/lib/api-authed";
import { currentMonthInTashkent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { monthDays, weekdayOf } from "./worktime-format";

/** «Мой график» — месячный календарь назначенных смен (пустой день = выходной) */
export function MySchedule() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [month, setMonth] = useState(currentMonthInTashkent());
  const [items, setItems] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await worktimeApi.assignments({ month }));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        router.replace("/login");
        return;
      }
      toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/tc нестабильны
  }, [month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка
    void load();
  }, [load]);

  const byDate = new Map(items.map((item) => [item.date, item]));
  const days = monthDays(month);
  const lead = days.length ? weekdayOf(days[0]) - 1 : 0;

  // 2024-01-01 — понедельник, отсюда порядок подписей дней недели
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      weekday: "short",
    }).format(new Date(Date.UTC(2024, 0, 1 + i)))
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker
          value={month}
          onChange={setMonth}
          placeholder={t("month")}
        />
      </div>

      {loading ? (
        <Skeleton className="h-72 w-full rounded-lg" />
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekdayNames.map((name) => (
            <div
              key={name}
              className="pb-1 text-center text-xs text-muted-foreground"
            >
              {name}
            </div>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <div key={`lead-${i}`} />
          ))}
          {days.map((date) => {
            const assignment = byDate.get(date);
            return (
              <div
                key={date}
                className={cn(
                  "flex min-h-16 flex-col gap-1 rounded-lg border p-1.5",
                  assignment ? "bg-background" : "bg-secondary/40"
                )}
              >
                <span className="text-xs text-muted-foreground">
                  {Number(date.slice(8))}
                </span>
                {assignment ? (
                  <span className="flex items-start gap-1 text-[0.7rem] leading-tight font-medium">
                    {assignment.shift.color && (
                      <span
                        aria-hidden
                        className="mt-1 size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: assignment.shift.color }}
                      />
                    )}
                    <span className="break-words">{assignment.shift.name}</span>
                  </span>
                ) : (
                  <span className="text-[0.7rem] text-muted-foreground">
                    {t("dayoffShort")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
