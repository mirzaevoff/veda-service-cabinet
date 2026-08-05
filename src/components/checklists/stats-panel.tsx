"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/components/common/date-picker";
import type { ChecklistStats, ChecklistStatsBucket } from "@/lib/api";
import { checklistsApi } from "@/lib/api-authed";
import { cn } from "@/lib/utils";

function pctClass(pct: number) {
  return pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";
}

function BucketTable({
  title,
  buckets,
}: {
  title: string;
  buckets: ChecklistStatsBucket[];
}) {
  const t = useTranslations("Checklists.stats");
  if (buckets.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("label")}</TableHead>
              <TableHead className="text-right">{t("generated")}</TableHead>
              <TableHead className="text-right">{t("completed")}</TableHead>
              <TableHead className="text-right">{t("completedLate")}</TableHead>
              <TableHead className="text-right">{t("missed")}</TableHead>
              <TableHead className="text-right">{t("onTime")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((bucket) => (
              <TableRow key={bucket.id}>
                <TableCell className="max-w-60 truncate font-medium">
                  {bucket.label}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {bucket.generated}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {bucket.completed}
                </TableCell>
                <TableCell className="text-right text-warning tabular-nums">
                  {bucket.completedLate}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {bucket.missed}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    pctClass(bucket.onTimePct)
                  )}
                >
                  {bucket.onTimePct}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function StatsPanel({ entityId }: { entityId: string }) {
  const t = useTranslations("Checklists.stats");

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [stats, setStats] = useState<ChecklistStats | null>(null);

  const reload = useCallback(() => {
    checklistsApi
      .stats(entityId, { from: from || undefined, to: to || undefined })
      .then(setStats)
      .catch(() => setStats(null));
  }, [entityId, from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при смене периода
    setStats(null);
    reload();
  }, [reload]);

  const totals = stats?.totals;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker value={from} onChange={setFrom} placeholder={t("from")} />
        <span className="text-muted-foreground">—</span>
        <DatePicker value={to} onChange={setTo} placeholder={t("to")} />
      </div>

      {!stats ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : totals && totals.generated === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <BarChart3 className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ["generated", totals!.generated, ""],
                ["completed", totals!.completed, "text-success"],
                ["completedLate", totals!.completedLate, "text-warning"],
                ["missed", totals!.missed, "text-destructive"],
                ["onTime", `${totals!.onTimePct}%`, pctClass(totals!.onTimePct)],
              ] as const
            ).map(([key, value, color]) => (
              <div
                key={key}
                className="flex flex-col gap-1 rounded-lg border border-border p-4"
              >
                <span className="text-xs text-muted-foreground">{t(key)}</span>
                <span className={cn("text-2xl font-semibold tabular-nums", color)}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <BucketTable title={t("byTemplate")} buckets={stats.byTemplate} />
          <BucketTable title={t("byUser")} buckets={stats.byUser} />
        </>
      )}
    </div>
  );
}
