"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Play, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { DatePicker } from "@/components/common/date-picker";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type {
  BankAccount,
  BankReconciliation,
  BankReconciliationStatus,
  Page,
} from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatTiyin } from "./bank-money";

const STATUS_STYLES: Record<BankReconciliationStatus, string> = {
  matched: "bg-success-light text-success",
  discrepancy: "bg-destructive/10 text-destructive",
  unconfirmed: "bg-warning-light text-warning",
  error: "bg-destructive/10 text-destructive",
};

/** Журнал ночных сверок + ручной запуск */
export function BankReconciliations({ accounts }: { accounts: BankAccount[] }) {
  const t = useTranslations("Bank.reconciliations");
  const tc = useTranslations("Common");
  const locale = useLocale();

  /** Дата сверки — ташкентский день; сервер может отдать и ISO-инстант */
  const formatRecDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : new Intl.DateTimeFormat(locale, {
          timeZone: "Asia/Tashkent",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(value));
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.bankManage);

  const [data, setData] = useState<Page<BankReconciliation> | null>(null);
  const [status, setStatus] = useState<"" | BankReconciliationStatus>("");
  const [runOpen, setRunOpen] = useState(false);
  const [runAccount, setRunAccount] = useState("");
  const [runDate, setRunDate] = useState("");
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    bankApi.reconciliations
      .list({ status: status || undefined, limit: 30 })
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1, limit: 30 }));
  }, [status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при смене фильтра
    setData(null);
    load();
  }, [load]);

  async function run() {
    if (!runAccount || !runDate) return;
    setRunning(true);
    try {
      const result = await bankApi.reconciliations.run(runAccount, runDate);
      toast.success(t("runDone", { status: t(`status.${result.status}`) }));
      setRunOpen(false);
      load();
    } catch {
      toast.error(t("genericError"));
    } finally {
      setRunning(false);
    }
  }

  const accountTitle = (id: string) =>
    accounts.find((a) => a.id === id)?.title ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status || "any"}
          items={{
            any: t("anyStatus"),
            matched: t("status.matched"),
            discrepancy: t("status.discrepancy"),
            unconfirmed: t("status.unconfirmed"),
            error: t("status.error"),
          }}
          onValueChange={(v) =>
            setStatus(v === "any" ? "" : (v as BankReconciliationStatus))
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("anyStatus")}</SelectItem>
            <SelectItem value="matched">{t("status.matched")}</SelectItem>
            <SelectItem value="discrepancy">{t("status.discrepancy")}</SelectItem>
            <SelectItem value="unconfirmed">{t("status.unconfirmed")}</SelectItem>
            <SelectItem value="error">{t("status.error")}</SelectItem>
          </SelectContent>
        </Select>

        {canManage && (
          <Button
            onClick={() => {
              setRunAccount(accounts[0]?.id ?? "");
              setRunDate("");
              setRunOpen(true);
            }}
            disabled={accounts.length === 0}
            className="ms-auto gap-2"
          >
            <Play className="size-4" />
            {t("run")}
          </Button>
        )}
      </div>

      {!data ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <ScanSearch className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((rec, i) => (
            <div
              key={rec.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border border-border px-4 py-3 duration-300 animate-in fade-in [animation-fill-mode:backwards]",
                rec.status === "discrepancy" && "border-destructive/40 bg-destructive/5"
              )}
              style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium tabular-nums">
                  {formatRecDate(rec.date)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {accountTitle(rec.bankAccountId)}
                </span>
                <Badge
                  variant="secondary"
                  className={cn("shrink-0", STATUS_STYLES[rec.status])}
                >
                  {t(`status.${rec.status}`)}
                </Badge>
                {rec.fin === 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t("dayNotClosed")}
                  </span>
                )}
              </div>
              <div className="grid gap-x-6 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-3">
                <span className="tabular-nums">
                  {t("docs")}: {rec.ourDocCount} / {rec.bankDocCount}
                </span>
                <span className="tabular-nums">
                  {t("debit")}: {formatTiyin(rec.ourTotalDebit)} /{" "}
                  {formatTiyin(rec.bankTotalDebit)}
                </span>
                <span className="tabular-nums">
                  {t("credit")}: {formatTiyin(rec.ourTotalCredit)} /{" "}
                  {formatTiyin(rec.bankTotalCredit)}
                </span>
              </div>
              {rec.message && (
                <p className="text-xs text-destructive">{rec.message}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ручная сверка */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("run")}</DialogTitle>
            <DialogDescription>{t("runHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("account")}
              </Label>
              <Select
                value={runAccount}
                items={Object.fromEntries(accounts.map((a) => [a.id, a.title]))}
                onValueChange={(v) => setRunAccount(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("date")}
              </Label>
              <DatePicker value={runDate} onChange={setRunDate} placeholder={t("date")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRunOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={run} disabled={running || !runAccount || !runDate}>
              {running ? <Spinner className="size-4" /> : t("runNow")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
