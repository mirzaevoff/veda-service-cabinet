"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Plus, Receipt, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { MonthPicker } from "@/components/common/month-picker";
import {
  ApiError,
  type Payroll,
  type PayrollAdjustment,
} from "@/lib/api";
import { SessionExpiredError, worktimeApi } from "@/lib/api-authed";
import {
  currentMonthInTashkent,
  formatMinutes,
  formatTiyin,
  fullName,
  sumToTiyin,
  tiyinToSum,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { payrollStatusStyle } from "../worktime-format";

/** Экран 10 — расчёт ЗП: расчётные листы по утверждённым табелям */
export function PayrollAdmin() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [month, setMonth] = useState(currentMonthInTashkent());
  const [items, setItems] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await worktimeApi.payrolls({ month }));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        router.replace("/login");
        return;
      }
      toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function generateAll() {
    setGenerating(true);
    try {
      await worktimeApi.generatePayroll({ month, all: true });
      toast.success(t("payrollGenerated"));
      await load();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (e instanceof ApiError && e.code === "ER2410")
        toast.error(t("needsApprovedTimesheet"));
      else if (e instanceof ApiError && e.code === "ER2411")
        toast.error(t("noPayTerms"));
      else toast.error(t("saveError"));
    } finally {
      setGenerating(false);
    }
  }

  const open = items.find((p) => p.id === openId) ?? null;
  if (open) {
    return (
      <PayslipDetail
        payroll={open}
        onBack={() => setOpenId(null)}
        onChanged={load}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("payrollHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker value={month} onChange={setMonth} placeholder={t("month")} />
        <Button
          className="ms-auto gap-1.5"
          disabled={generating}
          onClick={() => void generateAll()}
        >
          {generating ? (
            <Spinner className="size-4" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {t("generatePayrollAll")}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-lg bg-accent-light">
              <Receipt className="size-6 text-primary" />
            </span>
            <p className="font-medium">{t("noPayrolls")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenId(p.id)}
              className="flex items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{fullName(p.user)}</p>
                <p className="text-xs text-muted-foreground">
                  {t("toPay")}: {formatTiyin(p.netTiyin, locale)}
                </p>
              </div>
              <Badge className={payrollStatusStyle(p.status)}>
                {t(`payrollStatus.${p.status}`)}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PayslipDetail({
  payroll,
  onBack,
  onChanged,
}: {
  payroll: Payroll;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("Worktime");
  const locale = useLocale();
  const router = useRouter();

  const approved = payroll.status === "approved";
  const [additions, setAdditions] = useState<PayrollAdjustment[]>(
    payroll.additions
  );
  const [deductions, setDeductions] = useState<PayrollAdjustment[]>(
    payroll.deductions
  );
  const [busy, setBusy] = useState(false);

  const sum = (list: PayrollAdjustment[]) =>
    list.reduce((acc, x) => acc + (x.amountTiyin || 0), 0);
  const net = payroll.baseTiyin + sum(additions) - sum(deductions);

  async function save() {
    setBusy(true);
    try {
      await worktimeApi.updatePayroll(payroll.id, {
        additions: additions.filter((a) => a.label.trim() && a.amountTiyin),
        deductions: deductions.filter((d) => d.label.trim() && d.amountTiyin),
      });
      toast.success(t("payrollSaved"));
      await onChanged();
      onBack();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (e instanceof ApiError && e.code === "ER2412")
        toast.error(t("payrollLocked"));
      else toast.error(t("saveError"));
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await onChanged();
      onBack();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
      setBusy(false);
    }
  }

  const metrics = [
    { label: t("metricsPlanned"), value: String(payroll.metrics.plannedDays) },
    { label: t("metrics.workedDays"), value: String(payroll.metrics.workedDays) },
    { label: t("metrics.worked"), value: formatMinutes(payroll.metrics.workedMinutes) },
    { label: t("totals.late"), value: formatMinutes(payroll.metrics.lateMinutes) },
    { label: t("metrics.paidLeave"), value: String(payroll.metrics.paidLeaveDays) },
    { label: t("totals.overtime"), value: formatMinutes(payroll.metrics.overtimeMinutes) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("backToList")}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 font-medium">{fullName(payroll.user)}</p>
        <Badge className={payrollStatusStyle(payroll.status)}>
          {t(`payrollStatus.${payroll.status}`)}
        </Badge>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border p-2.5">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="mt-0.5 font-medium">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Расчёт */}
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("base")}</span>
          <span className="font-medium tabular-nums">
            {formatTiyin(payroll.baseTiyin, locale)}
          </span>
        </div>

        <AdjustmentList
          title={t("additions")}
          items={additions}
          onChange={setAdditions}
          disabled={approved}
          addLabel={t("addAddition")}
          labelPh={t("adjustmentLabel")}
          amountPh={t("adjustmentAmount")}
          tone="add"
        />
        <AdjustmentList
          title={t("deductions")}
          items={deductions}
          onChange={setDeductions}
          disabled={approved}
          addLabel={t("addDeduction")}
          labelPh={t("adjustmentLabel")}
          amountPh={t("adjustmentAmount")}
          tone="sub"
        />

        <div className="flex items-center justify-between border-t pt-3">
          <span className="font-medium">{t("toPay")}</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatTiyin(net, locale)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {approved ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void act(
                () => worktimeApi.reopenPayroll(payroll.id),
                t("payrollReopened")
              )
            }
          >
            {t("reopen")}
          </Button>
        ) : (
          <>
            <Button variant="outline" disabled={busy} onClick={() => void save()}>
              {busy ? <Spinner className="size-4" /> : t("save")}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void act(
                  () => worktimeApi.approvePayroll(payroll.id),
                  t("payrollApproved")
                )
              }
            >
              {t("approve")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function AdjustmentList({
  title,
  items,
  onChange,
  disabled,
  addLabel,
  labelPh,
  amountPh,
  tone,
}: {
  title: string;
  items: PayrollAdjustment[];
  onChange: (items: PayrollAdjustment[]) => void;
  disabled: boolean;
  addLabel: string;
  labelPh: string;
  amountPh: string;
  tone: "add" | "sub";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn("text-sm", tone === "add" ? "text-success" : "text-muted-foreground")}>
        {tone === "add" ? "+ " : "− "}
        {title}
      </span>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={item.label}
            placeholder={labelPh}
            disabled={disabled}
            className="flex-1"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...item, label: e.target.value };
              onChange(next);
            }}
          />
          <Input
            value={item.amountTiyin ? String(tiyinToSum(item.amountTiyin)) : ""}
            placeholder={amountPh}
            inputMode="numeric"
            disabled={disabled}
            className="w-36 tabular-nums"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...item, amountTiyin: sumToTiyin(e.target.value) };
              onChange(next);
            }}
          />
          {!disabled && (
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 self-start text-muted-foreground"
          onClick={() => onChange([...items, { label: "", amountTiyin: 0 }])}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
