"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, CircleAlert, PieChart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/common/date-picker";
import type { BankAccount, BankAccountKind, CashFlowReport as Report } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { cn } from "@/lib/utils";
import { formatTiyin } from "./bank-money";

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface CashFlowDrillDown {
  /** null — «Без статьи» */
  categoryId: string | null;
  from: string;
  to: string;
  accountId?: string;
}

/** Экран 6: «куда ушли деньги» — движение по статьям за период */
export function CashFlowReport({
  accounts,
  onDrillDown,
}: {
  accounts: BankAccount[];
  /** Переход в список операций статьи; не задан — перехода нет */
  onDrillDown?: (target: CashFlowDrillDown) => void;
}) {
  const t = useTranslations("Bank.report");
  const sel =
    "h-9 rounded-md border border-border bg-transparent px-2.5 text-sm outline-none focus-visible:border-primary/40";

  const now = new Date();
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(now));
  const [accountId, setAccountId] = useState("");
  const [kind, setKind] = useState<BankAccountKind | "">("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- индикатор перед запросом
    setLoading(true);
    bankApi
      .cashFlow({ from, to, accountId: accountId || undefined, kind: kind || undefined })
      .then((r) => !cancelled && setReport(r))
      .catch(() => !cancelled && toast.error(t("error")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t нестабилен
  }, [from, to, accountId, kind]);

  const balancedEquation =
    !!report && report.openingTiyin + report.inTiyin - report.outTiyin === report.closingTiyin;

  return (
    <div className="flex flex-col gap-4">
      {/* Фильтры */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm text-muted-foreground">{t("period")}</Label>
          <div className="flex items-center gap-2">
            <DatePicker recent value={from} onChange={setFrom} placeholder={t("from")} />
            <span className="text-muted-foreground">—</span>
            <DatePicker recent value={to} onChange={setTo} placeholder={t("to")} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm text-muted-foreground">{t("account")}</Label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={sel}>
            <option value="">{t("allAccounts")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
        {!accountId && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-muted-foreground">{t("kind")}</Label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as BankAccountKind | "")}
              className={sel}
            >
              <option value="">{t("kindAll")}</option>
              <option value="synced">{t("kindSynced")}</option>
              <option value="manual">{t("kindManual")}</option>
            </select>
          </div>
        )}
      </div>

      {loading && !report ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : !report ? null : (
        <div className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}>
          {/* Сводка: вход + приход − расход = исход */}
          <div className="grid gap-2 sm:grid-cols-4">
            <Tile label={t("opening")} value={formatTiyin(report.openingTiyin)} />
            <Tile label={t("in")} value={`+${formatTiyin(report.inTiyin)}`} tone="in" />
            <Tile label={t("out")} value={`−${formatTiyin(report.outTiyin)}`} tone="out" />
            <Tile label={t("closing")} value={formatTiyin(report.closingTiyin)} strong />
          </div>
          <p
            className={cn(
              "rounded-lg border px-3 py-2 text-sm tabular-nums",
              balancedEquation
                ? "border-border bg-secondary/40 text-muted-foreground"
                : "border-destructive/40 bg-destructive/5 text-destructive"
            )}
          >
            {formatTiyin(report.openingTiyin)} + {formatTiyin(report.inTiyin)} −{" "}
            {formatTiyin(report.outTiyin)} = <b>{formatTiyin(report.closingTiyin)}</b>
            {" · "}
            {balancedEquation ? t("equationOk") : t("equationBroken")}
          </p>

          {/* По статьям */}
          {report.categories.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
                <PieChart className="size-[26px] text-primary" strokeWidth={1.75} />
              </div>
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t("colCategory")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("colIn")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("colOut")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("colCount")}</th>
                    {onDrillDown && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.categories.map((c) => {
                    const uncategorized = c.categoryId === null;
                    return (
                      <tr
                        key={c.categoryId ?? "none"}
                        className={cn(uncategorized && "bg-warning-light/40")}
                      >
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "flex items-center gap-1.5",
                              uncategorized && "font-medium text-warning"
                            )}
                          >
                            {uncategorized && <CircleAlert className="size-4 shrink-0" />}
                            {uncategorized ? t("uncategorized") : c.name}
                          </span>
                          {uncategorized && (
                            <span className="text-xs text-muted-foreground">
                              {t("uncategorizedHint")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-success">
                          {c.inTiyin ? `+${formatTiyin(c.inTiyin)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {c.outTiyin ? `−${formatTiyin(c.outTiyin)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {c.count}
                        </td>
                        {onDrillDown && (
                          <td className="pr-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("showOperations")}
                              title={t("showOperations")}
                              onClick={() =>
                                onDrillDown({
                                  categoryId: c.categoryId,
                                  from,
                                  to,
                                  accountId: accountId || undefined,
                                })
                              }
                            >
                              <ArrowRight className="size-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "in" | "out";
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-xl font-bold" : "text-lg font-semibold",
          tone === "in" && "text-success"
        )}
      >
        {value}
      </span>
    </div>
  );
}
