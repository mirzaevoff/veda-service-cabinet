"use client";

import { useLocale, useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import type { AttendanceDayStatus, Timesheet, TimesheetDay } from "@/lib/api";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dayStatusLetter, dayStatusStyle, monthDays, weekdayOf } from "./worktime-format";

const STATUSES: AttendanceDayStatus[] = [
  "present",
  "late",
  "incomplete",
  "absent",
  "leave",
  "dayoff",
];

/** Легенда статусов дня — одинаковая на всех экранах табеля */
export function TimesheetLegend() {
  const t = useTranslations("Worktime");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUSES.map((status) => (
        <span
          key={status}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
            dayStatusStyle(status)
          )}
        >
          <span className="font-semibold">
            {dayStatusLetter({ date: "", status, workedMinutes: 0 })}
          </span>
          {t(`dayStatus.${status}`)}
        </span>
      ))}
    </div>
  );
}

/**
 * Месячная сетка табеля: буква + цвет статуса на каждый день.
 * onDayClick — для правки спорных дней (руководитель).
 */
export function TimesheetGrid({
  timesheet,
  onDayClick,
}: {
  timesheet: Timesheet;
  onDayClick?: (day: TimesheetDay) => void;
}) {
  const t = useTranslations("Worktime");
  const locale = useLocale();

  const byDate = new Map(timesheet.days.map((day) => [day.date, day]));
  const days = monthDays(timesheet.month);
  const lead = days.length ? weekdayOf(days[0]) - 1 : 0;

  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      weekday: "short",
    }).format(new Date(Date.UTC(2024, 0, 1 + i)))
  );

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {weekdayNames.map((name) => (
        <div key={name} className="pb-1 text-center text-xs text-muted-foreground">
          {name}
        </div>
      ))}
      {Array.from({ length: lead }).map((_, i) => (
        <div key={`lead-${i}`} />
      ))}
      {days.map((date) => {
        const day = byDate.get(date);
        if (!day) {
          return (
            <div
              key={date}
              className="flex min-h-14 flex-col rounded-lg border bg-secondary/40 p-1.5"
            >
              <span className="text-xs text-muted-foreground">
                {Number(date.slice(8))}
              </span>
            </div>
          );
        }

        const details = [
          t(`dayStatus.${day.status}`),
          day.workedMinutes ? formatMinutes(day.workedMinutes) : null,
          day.lateMinutes ? t("lateBy", { value: formatMinutes(day.lateMinutes) }) : null,
          day.overtimeMinutes
            ? t("overtimeBy", { value: formatMinutes(day.overtimeMinutes) })
            : null,
          day.flagged ? t("flaggedHint") : null,
        ]
          .filter(Boolean)
          .join(" · ");

        const interactive = Boolean(onDayClick);

        return (
          <button
            key={date}
            type="button"
            title={details}
            disabled={!interactive}
            onClick={() => onDayClick?.(day)}
            className={cn(
              "flex min-h-14 flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left transition-colors",
              dayStatusStyle(day.status),
              interactive && "hover:brightness-95",
              !interactive && "cursor-default"
            )}
          >
            <span className="flex w-full items-center justify-between text-xs opacity-80">
              {Number(date.slice(8))}
              {day.flagged && <Flag className="size-3" aria-label={t("flaggedHint")} />}
            </span>
            <span className="text-sm font-semibold">{dayStatusLetter(day)}</span>
            {day.workedMinutes > 0 && (
              <span className="text-[0.65rem] opacity-80">
                {formatMinutes(day.workedMinutes)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
