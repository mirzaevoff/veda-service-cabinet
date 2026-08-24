"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { IikoInvoiceKind, IikoInvoicesSummary } from "@/lib/api";
import { formatAmount } from "./invoice-format";
import { cn } from "@/lib/utils";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Плавный счётчик от 0 до target (easeOutCubic), с уважением к reduced-motion */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      return;
    }
    let start: number | null = null;
    const from = 0;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

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
  const [grown, setGrown] = useState(false);
  const values = points.map((p) => (kind === "partner" ? p.partner : p.customer));
  const max = Math.max(1, ...values);
  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(
      new Date(Number(y), Number(mo) - 1, 1)
    );
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGrown(true);
      return;
    }
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
          const target = Math.max(h, v > 0 ? 3 : 0);
          return (
            <div
              key={p.month}
              className="group relative flex flex-1 flex-col items-center justify-end gap-1"
              style={{ height: "100%" }}
            >
              <div
                className="w-full rounded-t bg-primary/80 transition-[height,background-color] duration-700 ease-out group-hover:bg-primary motion-reduce:transition-none"
                style={{
                  height: `${grown ? target : 0}%`,
                  transitionDelay: `${i * 45}ms`,
                }}
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

/** Метрика в карточке сводки с count-up анимацией */
function Metric({
  label,
  value,
  format,
  sub,
  tone,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  sub?: string;
  tone?: "success" | "warning";
}) {
  const animated = useCountUp(value);
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
        {format(animated)}
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

  const count = (n: number) => Math.round(n).toLocaleString(locale);
  const money = (n: number) => formatAmount(n, currency, locale);

  return (
    <div className="flex flex-col gap-3">
      {summary.scope.ytd && (
        <span className="text-xs text-muted-foreground">
          {t("scopeYtd", { year: new Date().getFullYear() })}
        </span>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("mTotal")} value={summary.total} format={count} />
        <Metric
          label={t("mPaid")}
          value={summary.paid}
          format={count}
          tone="success"
        />
        <Metric
          label={t("mUnpaid")}
          value={summary.unpaid}
          format={count}
          tone={summary.unpaid > 0 ? "warning" : undefined}
        />
        <Metric label={t("mCancelled")} value={summary.cancelled} format={count} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric
          label={t(kind === "partner" ? "mTotalPartner" : "mTotalCustomer")}
          value={totals?.amount ?? 0}
          format={money}
          sub={t("ofCount", { count: totals?.count ?? 0 })}
        />
        <Metric
          label={t(kind === "partner" ? "mOweIiko" : "mDebtors")}
          value={receivable?.amount ?? 0}
          format={money}
          sub={
            kind === "partner"
              ? t("ofCount", { count: receivable?.count ?? 0 })
              : t("debtorsCount", {
                  count: (summary.receivable.customer?.debtors ?? 0) as number,
                })
          }
          tone={(receivable?.amount ?? 0) > 0 ? "warning" : undefined}
        />
      </div>

      <MonthlyChart points={summary.byMonth} kind={kind} currency={currency} />
    </div>
  );
}
