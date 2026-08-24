"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Wallet } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { ApiError, type EntityBalance, type LedgerEntry } from "@/lib/api";
import { balancesApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  LEDGER_TYPE_STYLES,
  formatLedgerAmount,
} from "@/components/balances/ledger-format";

/** Баланс ЮЛ + движения леджера + ручная корректировка */
export function EntityBalanceSection({ entityId }: { entityId: string }) {
  const t = useTranslations("Balances");
  const locale = useLocale();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.balancesManage);

  const [balance, setBalance] = useState<EntityBalance | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    balancesApi.entityBalance(entityId).then(setBalance).catch(() => setBalance(null));
    balancesApi
      .entityLedger(entityId, { limit: 20 })
      .then((p) => setLedger(p.items))
      .catch(() => setLedger([]));
  }, [entityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const sum = Number(amount.replace(",", "."));
    if (!Number.isFinite(sum) || sum === 0) {
      setError(t("amountRequired"));
      return;
    }
    if (!comment.trim()) {
      setError(t("commentRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await balancesApi.correct(entityId, Math.round(sum * 100), comment.trim());
      toast.success(t("corrected"));
      setOpen(false);
      setAmount("");
      setComment("");
      load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1502") setError(t("errors.ER1502"));
      else setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-light">
            <Wallet className="size-5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("balance")}
            </span>
            {balance ? (
              <span className="text-2xl font-bold tabular-nums">
                {balance.balanceSum.toLocaleString(locale)} {t("soum")}
              </span>
            ) : (
              <Skeleton className="h-7 w-32" />
            )}
          </div>
          {balance && !balance.inSync && (
            <Badge variant="secondary" className="bg-warning-light text-warning">
              {t("outOfSync")}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
            <Pencil className="size-4" />
            {t("correct")}
          </Button>
        )}
      </div>

      {/* Движения */}
      {!ledger ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : ledger.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("ledgerEmpty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colDate")}</TableHead>
                <TableHead>{t("colType")}</TableHead>
                <TableHead>{t("colComment")}</TableHead>
                <TableHead className="text-right">{t("colAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(e.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={LEDGER_TYPE_STYLES[e.type]}>
                      {t(`type.${e.type}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-64">
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {e.comment || e.payer?.name || "—"}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      e.amountTiyin < 0 ? "text-destructive" : "text-success"
                    )}
                  >
                    {formatLedgerAmount(e, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("correctTitle")}</DialogTitle>
            <DialogDescription>{t("correctHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="corr-amount" className="text-sm font-medium text-muted-foreground">
                {t("amountLabel")}
              </Label>
              <Input
                id="corr-amount"
                inputMode="decimal"
                placeholder="-50000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="tabular-nums"
              />
              <span className="text-xs text-muted-foreground">{t("amountHint")}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="corr-comment" className="text-sm font-medium text-muted-foreground">
                {t("commentLabel")}
              </Label>
              <Textarea
                id="corr-comment"
                rows={2}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  setError(null);
                }}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Spinner className="size-4" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
