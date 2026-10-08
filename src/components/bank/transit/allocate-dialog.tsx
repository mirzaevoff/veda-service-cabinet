"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { Spinner } from "@/components/ui/spinner";
import { ApiError, type TransitJournalRow, type TransitTransfer } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatTiyin, parseSumToTiyin, tiyinToSumInput } from "../bank-money";

/**
 * Ручная привязка расхода (выплаты/возврата) к конкретному переводу. Нужна,
 * когда автоматика намеренно не гасит чужой перевод — решает человек.
 */
export function AllocateDialog({
  row,
  transfers,
  onClose,
  onDone,
}: {
  row: TransitJournalRow | null;
  transfers: TransitTransfer[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("Bank.transit.allocate");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const [transferId, setTransferId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const open = transfers.filter((x) => x.remainingTiyin > 0);
  const chosen = open.find((x) => x.id === transferId);
  const max = row && chosen ? Math.min(row.unallocatedTiyin, chosen.remainingTiyin) : 0;

  useEffect(() => {
    if (!row) return;
    /* eslint-disable react-hooks/set-state-in-effect -- инициализация при открытии */
    const first = transfers.find((x) => x.remainingTiyin > 0);
    setTransferId(first?.id ?? "");
    setAmount(first ? tiyinToSumInput(Math.min(row.unallocatedTiyin, first.remainingTiyin)) : "");
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при открытии
  }, [row]);

  const tiyin = parseSumToTiyin(amount);
  const tooMuch = tiyin !== null && tiyin > max;

  async function submit() {
    if (!row || !chosen || busyRef.current) return;
    if (tiyin === null || tiyin <= 0) return setError(t("errors.amount"));
    if (tiyin > max) return setError(t("errors.tooMuch", { max: formatTiyin(max) }));
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await bankApi.transit.allocate({ outflowId: row.id, transferId: chosen.id, amountTiyin: tiyin });
      toast.success(t("done"));
      onDone();
      onClose();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      if (code === "ER1218") setError(t("errors.overRemaining"));
      else if (code === "ER1217") setError(t("errors.wrongPair"));
      else setError(t("errors.generic"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {row &&
              t("subtitle", {
                party: row.party || "—",
                sum: formatTiyin(row.unallocatedTiyin),
              })}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t("hint")}</p>

        {open.length === 0 ? (
          <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
            {t("noOpenTransfers")}
          </p>
        ) : (
          <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
            {open.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  setTransferId(x.id);
                  if (row) setAmount(tiyinToSumInput(Math.min(row.unallocatedTiyin, x.remainingTiyin)));
                  setError(null);
                }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  x.id === transferId
                    ? "border-primary/40 bg-accent-light"
                    : "border-border hover:border-primary/30"
                )}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{t("transferOf", { date: formatDay(x.date, locale) })}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t("transferTotal", { sum: formatTiyin(x.totalTiyin) })}
                  </span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {t("remaining")}
                  <br />
                  <b className="text-sm tabular-nums text-foreground">{formatTiyin(x.remainingTiyin)}</b>
                </span>
              </button>
            ))}
          </div>
        )}

        {chosen && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">{t("amount")}</span>
            <Input
              value={amount}
              inputMode="decimal"
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              aria-invalid={tooMuch}
              className="tabular-nums"
            />
            <span className={cn("text-xs", tooMuch ? "text-destructive" : "text-muted-foreground")}>
              {t("maxHint", { max: formatTiyin(max) })}
            </span>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !chosen || tooMuch}>
            {busy ? <Spinner className="size-4" /> : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
