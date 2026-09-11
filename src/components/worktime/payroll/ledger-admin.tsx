"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Landmark, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { MonthPicker } from "@/components/common/month-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type EmployeeLedgerEntry,
  type EmployeeLedgerSummaryRow,
} from "@/lib/api";
import { SessionExpiredError, worktimeApi } from "@/lib/api-authed";
import {
  currentMonthInTashkent,
  formatTashkentDateTime,
  formatTiyin,
  sumToTiyin,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { formatSignedTiyin, ledgerTypeStyle } from "../worktime-format";

/** Экран 11 — леджер и выплаты: долг компании перед сотрудниками */
export function LedgerAdmin() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [month, setMonth] = useState(currentMonthInTashkent());
  const [rows, setRows] = useState<EmployeeLedgerSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payFor, setPayFor] = useState<EmployeeLedgerSummaryRow | null>(null);
  const [movementsFor, setMovementsFor] =
    useState<EmployeeLedgerSummaryRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await worktimeApi.ledgerSummary(month));
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("ledgerHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker value={month} onChange={setMonth} placeholder={t("month")} />
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-lg bg-accent-light">
              <Landmark className="size-6 text-primary" />
            </span>
            <p className="font-medium">{t("noSummary")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead className="text-right">{t("accrued")}</TableHead>
                <TableHead className="text-right">{t("debt")}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell>
                    <button
                      type="button"
                      className="font-medium hover:text-primary"
                      onClick={() => setMovementsFor(row)}
                    >
                      {row.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatTiyin(row.accruedTiyin, locale)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      row.balanceTiyin > 0 && "text-primary"
                    )}
                  >
                    {formatTiyin(row.balanceTiyin, locale)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={row.balanceTiyin <= 0}
                      onClick={() => setPayFor(row)}
                    >
                      {t("pay")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {payFor && (
        <PayDialog
          row={payFor}
          month={month}
          onClose={() => setPayFor(null)}
          onSaved={async () => {
            setPayFor(null);
            await load();
          }}
        />
      )}
      {movementsFor && (
        <MovementsDialog
          row={movementsFor}
          onClose={() => setMovementsFor(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function PayDialog({
  row,
  month,
  onClose,
  onSaved,
}: {
  row: EmployeeLedgerSummaryRow;
  month: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [amount, setAmount] = useState(String(Math.round(row.balanceTiyin / 100)));
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const amountTiyin = sumToTiyin(amount);
    if (!amountTiyin) {
      toast.error(t("saveError"));
      return;
    }
    setSaving(true);
    try {
      await worktimeApi.pay({
        userId: row.userId,
        amountTiyin,
        period: month,
        comment: comment.trim() || undefined,
      });
      toast.success(t("paid"));
      await onSaved();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("payTo", { name: row.name })}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-secondary/50 p-3 text-sm">
            <span className="text-muted-foreground">{t("debt")}: </span>
            <span className="font-medium">
              {formatTiyin(row.balanceTiyin, locale)}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("payAmount")}</Label>
            <Input
              value={amount}
              inputMode="numeric"
              className="tabular-nums"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("payComment")}</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Spinner className="size-4" /> : t("pay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementsDialog({
  row,
  onClose,
  onChanged,
}: {
  row: EmployeeLedgerSummaryRow;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [entries, setEntries] = useState<EmployeeLedgerEntry[] | null>(null);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await worktimeApi.ledger({ userId: row.userId }));
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function saveCorrection() {
    const amountTiyin = sumToTiyin(amount);
    if (!amountTiyin) {
      toast.error(t("saveError"));
      return;
    }
    setSaving(true);
    try {
      await worktimeApi.correct({
        userId: row.userId,
        amountTiyin,
        comment: comment.trim() || undefined,
      });
      toast.success(t("corrected"));
      setCorrectionMode(false);
      setAmount("");
      setComment("");
      await load();
      await onChanged();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("movementsOf", { name: row.name })}</DialogTitle>
        </DialogHeader>

        {entries === null ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
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
                    {[entry.period, entry.comment]
                      .filter(Boolean)
                      .join(" · ") ||
                      formatTashkentDateTime(entry.createdAt, locale)}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-medium tabular-nums",
                    ledgerTypeStyle(entry.type)
                  )}
                >
                  {formatSignedTiyin(entry.amountTiyin, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {correctionMode ? (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t("correctionAmount")}</Label>
              <Input
                value={amount}
                inputMode="numeric"
                className="tabular-nums"
                placeholder="± сум"
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("payComment")}</Label>
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCorrectionMode(false)}
              >
                {tc("cancel")}
              </Button>
              <Button size="sm" disabled={saving} onClick={() => void saveCorrection()}>
                {saving ? <Spinner className="size-4" /> : t("save")}
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCorrectionMode(true)}
            >
              <Wallet className="size-4" />
              {t("correction")}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {tc("close")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
