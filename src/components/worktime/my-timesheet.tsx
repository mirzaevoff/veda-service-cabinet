"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { MonthPicker } from "@/components/common/month-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Timesheet } from "@/lib/api";
import { SessionExpiredError, worktimeApi } from "@/lib/api-authed";
import { currentMonthInTashkent, formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { TimesheetGrid, TimesheetLegend } from "./timesheet-grid";
import { timesheetStatusStyle } from "./worktime-format";

/** «Мой табель» — только чтение: сетка дней, итоги и статус согласования */
export function MyTimesheet() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [month, setMonth] = useState(currentMonthInTashkent());
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await worktimeApi.timesheets({ month });
      setTimesheet(list[0] ?? null);
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

  const totals = timesheet?.totals;
  const stats = totals
    ? [
        { label: t("totals.workedDays"), value: String(totals.workedDays ?? 0) },
        {
          label: t("totals.worked"),
          value: formatMinutes(
            totals.workedMinutes ??
              (totals.workedHours != null ? totals.workedHours * 60 : null)
          ),
        },
        {
          label: t("totals.late"),
          value: totals.lateMinutes
            ? formatMinutes(totals.lateMinutes)
            : String(totals.lateCount ?? 0),
        },
        { label: t("totals.absences"), value: String(totals.absences ?? 0) },
        {
          label: t("totals.paidLeave"),
          value: String(totals.paidLeaveDays ?? 0),
        },
        {
          label: t("totals.overtime"),
          value: formatMinutes(totals.overtimeMinutes ?? 0),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker value={month} onChange={setMonth} placeholder={t("month")} />
        {timesheet && (
          <Badge className={cn("ms-auto", timesheetStatusStyle(timesheet.status))}>
            {t(`timesheetStatus.${timesheet.status}`)}
          </Badge>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-72 w-full rounded-lg" />
      ) : !timesheet ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-lg bg-accent-light">
              <ClipboardList className="size-6 text-primary" />
            </span>
            <p className="font-medium">{t("noTimesheet")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("noTimesheetHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-0.5 font-medium">{stat.value}</p>
              </div>
            ))}
          </div>
          <TimesheetLegend />
          <TimesheetGrid timesheet={timesheet} />
        </>
      )}
    </div>
  );
}
