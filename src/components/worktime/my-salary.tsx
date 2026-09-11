"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { MonthPicker } from "@/components/common/month-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmployeeLedgerEntry, Payroll } from "@/lib/api";
import { SessionExpiredError, worktimeApi } from "@/lib/api-authed";
import {
  currentMonthInTashkent,
  formatMinutes,
  formatTashkentDateTime,
  formatTiyin,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import {
  formatSignedTiyin,
  ledgerTypeStyle,
  payrollStatusStyle,
} from "./worktime-format";

/** «Моя зарплата» — баланс (долг компании), движения леджера и расчётный лист */
export function MySalary() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [month, setMonth] = useState(currentMonthInTashkent());
  const [balanceTiyin, setBalanceTiyin] = useState<number | null>(null);
  const [entries, setEntries] = useState<EmployeeLedgerEntry[]>([]);
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [balance, ledger, payrolls] = await Promise.all([
        worktimeApi.ledgerBalance(),
        worktimeApi.ledger(),
        worktimeApi.payrolls({ month }),
      ]);
      setBalanceTiyin(balance.balanceTiyin);
      setEntries(ledger);
      setPayroll(payrolls[0] ?? null);
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

  if (loading) return <Skeleton className="h-80 w-full rounded-lg" />;

  return (
    <div className="flex flex-col gap-4">
      {/* Баланс — что компания должна сотруднику */}
      <Card>
        <CardContent className="flex flex-col items-center gap-1.5 py-8 text-center">
          <span className="grid size-12 place-items-center rounded-lg bg-accent-light">
            <Wallet className="size-6 text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">{t("balanceLabel")}</p>
          <p className="text-3xl font-semibold">
            {formatTiyin(balanceTiyin ?? 0, locale)}
          </p>
        </CardContent>
      </Card>

      {/* Расчётный лист за месяц */}
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker value={month} onChange={setMonth} placeholder={t("month")} />
        {payroll && (
          <Badge className={cn("ms-auto", payrollStatusStyle(payroll.status))}>
            {t(`payrollStatus.${payroll.status}`)}
          </Badge>
        )}
      </div>

      {payroll ? (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="font-medium">{t("payslip")}</p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Metric label={t("metrics.workedDays")} value={String(payroll.metrics.workedDays)} />
            <Metric
              label={t("metrics.worked")}
              value={formatMinutes(payroll.metrics.workedMinutes)}
            />
            <Metric
              label={t("metrics.late")}
              value={formatMinutes(payroll.metrics.lateMinutes)}
            />
            <Metric
              label={t("metrics.paidLeave")}
              value={String(payroll.metrics.paidLeaveDays)}
            />
          </div>

          <div className="mt-2 flex flex-col gap-1.5 text-sm">
            <Row label={t("base")} value={formatTiyin(payroll.baseTiyin, locale)} />
            {payroll.additions.map((item, i) => (
              <Row
                key={`add-${i}`}
                label={item.label}
                value={formatSignedTiyin(item.amountTiyin, locale)}
                muted
              />
            ))}
            {payroll.deductions.map((item, i) => (
              <Row
                key={`ded-${i}`}
                label={item.label}
                value={formatSignedTiyin(-Math.abs(item.amountTiyin), locale)}
                muted
              />
            ))}
            <div className="mt-1 flex items-center justify-between border-t pt-2 font-medium">
              <span>{t("net")}</span>
              <span>{formatTiyin(payroll.netTiyin, locale)}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          {t("noPayroll")}
        </p>
      )}

      {/* Движения леджера */}
      <div className="flex flex-col gap-2">
        <p className="font-medium">{t("movements")}</p>
        {entries.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            {tc("nothingFound")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">
                    {t(`ledgerType.${entry.type}`)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[entry.period, entry.comment].filter(Boolean).join(" · ") ||
                      formatTashkentDateTime(entry.createdAt, locale)}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-medium",
                    ledgerTypeStyle(entry.type)
                  )}
                >
                  {formatSignedTiyin(entry.amountTiyin, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={muted ? "text-muted-foreground" : undefined}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
