"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { Spinner } from "@/components/ui/spinner";
import type { BankTransaction } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { formatTiyin } from "./bank-money";

/** Экран 3: сторно — операция остаётся видна, но в баланс не идёт. Причина обязательна */
export function VoidDialog({
  transaction,
  onClose,
  onDone,
}: {
  transaction: BankTransaction | null;
  onClose: () => void;
  onDone: (tx: BankTransaction) => void;
}) {
  const t = useTranslations("Bank.void");
  const tc = useTranslations("Common");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при открытии
    if (transaction) setReason("");
  }, [transaction]);

  async function submit() {
    if (!transaction || !reason.trim() || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const updated = await bankApi.transactions.void(transaction.id, reason.trim());
      toast.success(t("done"));
      onDone(updated);
      onClose();
    } catch {
      toast.error(t("error"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!transaction} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {transaction &&
              t("subtitle", {
                sum: `${transaction.direction === "in" ? "+" : "−"}${formatTiyin(transaction.amount)}`,
              })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <textarea
          value={reason}
          autoFocus
          maxLength={300}
          rows={3}
          placeholder={t("reasonPlaceholder")}
          onChange={(e) => setReason(e.target.value)}
          className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-primary/40"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || !reason.trim()}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {busy ? <Spinner className="size-4" /> : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
