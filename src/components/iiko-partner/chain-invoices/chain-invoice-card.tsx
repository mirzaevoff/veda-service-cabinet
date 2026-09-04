"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  FileText,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, type ChainInvoice } from "@/lib/api";
import { chainInvoicesApi } from "@/lib/api-authed";
import { formatTiyin } from "@/lib/format";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";
import { CHAIN_STATUS_STYLES } from "./chain-format";

/** Открыть PDF счёта во вкладке (authed blob → objectURL) */
async function openPdf(id: string, onError: () => void) {
  try {
    const blob = await chainInvoicesApi.pdf(id);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    onError();
  }
}

export function ChainInvoiceCard({
  invoice,
  canManage,
  onChanged,
}: {
  invoice: ChainInvoice;
  canManage: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("ChainInvoices");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isBasket = !invoice.legalEntity;

  async function act(
    action: "issue" | "pay" | "cancel",
    type: string,
    description: string
  ) {
    setBusy(action);
    try {
      await chainInvoicesApi[action](invoice._id);
      logActivity({ type, category: "Счета iiko", description, targetType: "chainInvoice", targetId: invoice._id });
      toast.success(t(`${action}Done`));
      setConfirmCancel(false);
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) toast.error(t(`${action}NotAllowed`));
      else toast.error(t("genericError"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4",
        isBasket ? "border-warning/40 bg-warning-light/20" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {invoice.legalEntityName || t(`flags.${invoice.reason || "unmapped"}`)}
            </span>
            <Badge variant="secondary" className={cn("font-normal", CHAIN_STATUS_STYLES[invoice.status])}>
              {t(`status.${invoice.status}`)}
            </Badge>
            {isBasket && invoice.reason && (
              <Badge variant="secondary" className="bg-warning-light text-warning">
                {t(`flags.${invoice.reason}`)}
              </Badge>
            )}
          </div>
          {invoice.number && (
            <span className="font-mono text-xs text-muted-foreground">{invoice.number}</span>
          )}
        </div>
        <span className="shrink-0 text-lg font-bold tabular-nums">
          {formatTiyin(invoice.totalUzsTiyin, locale)}
        </span>
      </div>

      {/* Строки (сворачиваемо) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        {t("linesCount", { count: invoice.lines.length })}
      </button>
      {open && (
        <div className="flex flex-col divide-y divide-border/60 rounded-md border border-border/60 px-3">
          {invoice.lines.map((line, i) => (
            <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{line.venueName}</span>
                <span className="text-muted-foreground"> · {line.product} ×{line.qty}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatTiyin(Math.round(line.amountMinor * invoice.rate), locale)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Действия */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void openPdf(invoice._id, () => toast.error(t("pdfError")))}>
          <FileText className="size-4" />
          {t("pdf")}
        </Button>
        {canManage && invoice.status === "draft" && invoice.issuable && (
          <Button size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => void act("issue", "chainInvoice.issue", "Выпуск счёта сети")}>
            {busy === "issue" ? <Spinner className="size-4" /> : <Send className="size-4" />}
            {t("issue")}
          </Button>
        )}
        {canManage && invoice.status === "issued" && (
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => void act("pay", "chainInvoice.pay", "Оплата счёта сети")}>
            {busy === "pay" ? <Spinner className="size-4" /> : <CheckCircle2 className="size-4" />}
            {t("markPaid")}
          </Button>
        )}
        {canManage && (invoice.status === "issued" || invoice.status === "paid") && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" disabled={busy !== null} onClick={() => setConfirmCancel(true)}>
            <Ban className="size-4" />
            {t("cancel")}
          </Button>
        )}
        {isBasket && (
          <span className="text-xs text-muted-foreground">{t("basketHint")}</span>
        )}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cancelConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void act("cancel", "chainInvoice.cancel", "Отмена счёта сети")}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
