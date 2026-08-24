"use client";

import { useLocale, useTranslations } from "next-intl";
import type { IikoInvoiceKind, IikoInvoicesSummary } from "@/lib/api";
import { formatAmount } from "./invoice-format";
import { cn } from "@/lib/utils";

/** Помесячный столбчатый график по активному виду (одна валюта) */
function MonthlyChart({
  points,
  kind,
  currency,
}: {
  points: IikoInvoicesSummary["byMonth"];
  kind: IikoInvoiceKind;
  currency: string;
}) {
  const locale = useLocale();
  const t = useTranslations("IikoPartner.invoices");
  const values = points.map((p) => (kind === "partner" ? p.partner : p.customer));
  const max = Math.max(1, ...values);
  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(
      new Date(Number(y), Number(mo) - 1, 1)
    );
  };

  if (points.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("chartTitle")}
      </span>
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {points.map((p, i) => {
          const v = values[i];
          const h = Math.round((v / max) * 100);
          return (
            <div
              key={p.month}
              className="group relative flex flex-1 flex-col items-center justify-end gap-1"
              style={{ height: "100%" }}
            >
              <div
                className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(h, v > 0 ? 3 : 0)}%` }}
              />
              <span className="text-[0.65rem] text-muted-foreground">
                {monthLabel(p.month)}
              </span>
              {/* тултип */}
              <div className="pointer-events-none absolute -top-8 z-10 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100">
                {formatAmount(v, currency, locale)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Метрика в карточке сводки */
function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "warning";
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border p-4 duration-300 animate-in fade-in">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

/** Богатая сводка по счетам (кросс-вид, YTD): метрики, долги, график */
export function InvoicesSummary({
  summary,
  kind,
}: {
  summary: IikoInvoicesSummary;
  kind: IikoInvoiceKind;
}) {
  const t = useTranslations("IikoPartner.invoices");
  const locale = useLocale();
  const currency = kind === "partner" ? "RUB" : "USD";

  const receivable =
    kind === "partner" ? summary.receivable.partner : summary.receivable.customer;
  const totals = kind === "partner" ? summary.totals.partner : summary.totals.customer;

  return (
    <div className="flex flex-col gap-3">
      {summary.scope.ytd && (
        <span className="text-xs text-muted-foreground">
          {t("scopeYtd", { year: new Date().getFullYear() })}
        </span>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("mTotal")} value={String(summary.total)} />
        <Metric label={t("mPaid")} value={String(summary.paid)} tone="success" />
        <Metric
          label={t("mUnpaid")}
          value={String(summary.unpaid)}
          tone={summary.unpaid > 0 ? "warning" : undefined}
        />
        <Metric
          label={t("mCancelled")}
          value={String(summary.cancelled)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric
          label={t(kind === "partner" ? "mTotalPartner" : "mTotalCustomer")}
          value={formatAmount(totals?.amount ?? 0, currency, locale)}
          sub={t("ofCount", { count: totals?.count ?? 0 })}
        />
        <Metric
          label={t(kind === "partner" ? "mOweIiko" : "mDebtors")}
          value={formatAmount(receivable?.amount ?? 0, currency, locale)}
          sub={
            kind === "partner"
              ? t("ofCount", { count: receivable?.count ?? 0 })
              : t("debtorsCount", {
                  count:
                    (summary.receivable.customer?.debtors ?? 0) as number,
                })
          }
          tone={(receivable?.amount ?? 0) > 0 ? "warning" : undefined}
        />
      </div>

      <MonthlyChart points={summary.byMonth} kind={kind} currency={currency} />
    </div>
  );
}
