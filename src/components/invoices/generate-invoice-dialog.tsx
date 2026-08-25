"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, type Invoice, type LegalEntity } from "@/lib/api";
import { invoicesApi, legalEntitiesApi } from "@/lib/api-authed";
import { MonthPicker } from "@/components/common/month-picker";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { formatSum } from "./invoice-format";

type Selected = { id: string; name: string };

/** Генерация сводного счёта: выбор ЮЛ (если не задан), предпросмотр, доп-поля */
export function GenerateInvoiceDialog({
  open,
  onClose,
  legalEntity,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Предзаданное юрлицо (со страницы ЮЛ) — тогда пикер скрыт */
  legalEntity?: Selected;
  onCreated: (invoice: Invoice) => void;
}) {
  const t = useTranslations("Invoices");
  const tc = useTranslations("Common");
  const locale = useLocale();

  const [selected, setSelected] = useState<Selected | null>(null);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350);
  const [options, setOptions] = useState<LegalEntity[] | null>(null);

  const [period, setPeriod] = useState("");
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [didoxWarning, setDidoxWarning] = useState("");
  const [partialMonthNote, setPartialMonthNote] = useState("");
  const [paymentLkBlock, setPaymentLkBlock] = useState("");

  const [creating, setCreating] = useState(false);

  // Сброс при открытии; если ЮЛ задано — сразу выбираем его
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- инициализация при открытии
    setSelected(legalEntity ?? null);
    setQ("");
    setOptions(null);
    setPeriod("");
    setPreview(null);
    setPreviewErr(null);
    setShowAdvanced(false);
    setDidoxWarning("");
    setPartialMonthNote("");
    setPaymentLkBlock("");
  }, [open, legalEntity]);

  // Поиск ЮЛ (когда не задано снаружи)
  useEffect(() => {
    if (!open || legalEntity || selected) return;
    let cancelled = false;
    legalEntitiesApi
      .list({ search: debounced || undefined, limit: 20 })
      .then((page) => !cancelled && setOptions(page.items))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [open, legalEntity, selected, debounced]);

  // Предпросмотр (dryRun) при выборе ЮЛ
  useEffect(() => {
    if (!open || !selected) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- индикатор загрузки перед dryRun-запросом
    setPreviewLoading(true);
    setPreview(null);
    setPreviewErr(null);
    invoicesApi
      .create({ legalEntityId: selected.id, period: period || undefined }, true)
      .then((inv) => {
        if (!cancelled) setPreview(inv);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.code === "ER1601")
          setPreviewErr(t("noUnpaid"));
        else if (e instanceof ApiError && e.code === "ER700")
          setPreviewErr(t("entityNotFound"));
        else setPreviewErr(t("genericError"));
      })
      .finally(() => !cancelled && setPreviewLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, selected, period, t]);

  async function create() {
    if (!selected || !preview) return;
    setCreating(true);
    try {
      const inv = await invoicesApi.create(
        {
          legalEntityId: selected.id,
          period: period || undefined,
          didoxWarning: didoxWarning.trim() || undefined,
          partialMonthNote: partialMonthNote.trim() || undefined,
          paymentLkBlock: paymentLkBlock.trim() || undefined,
        },
        false
      );
      toast.success(t("created"));
      onCreated(inv);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1601") toast.error(t("noUnpaid"));
      else toast.error(t("genericError"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("generateTitle")}</DialogTitle>
          <DialogDescription>{t("generateHint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Выбор ЮЛ */}
          {selected ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <span className="min-w-0 truncate text-sm font-medium">
                {selected.name}
              </span>
              {!legalEntity && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setSelected(null);
                    setPreview(null);
                    setPreviewErr(null);
                  }}
                >
                  {tc("change")}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("entitySearchPlaceholder")}
                  className="pl-9"
                />
              </div>
              {!options ? (
                <Skeleton className="h-24 rounded-lg" />
              ) : options.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("entityNotFound")}
                </p>
              ) : (
                <div className="-mr-1 flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
                  {options.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelected({ id: e.id, name: e.name })}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {e.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {e.taxId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Месяц (необязательно) */}
          {selected && (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="invoice-period" className="text-sm text-muted-foreground">
                {t("periodMonth")}
              </Label>
              <MonthPicker
                id="invoice-period"
                value={period}
                onChange={setPeriod}
                placeholder={t("periodAll")}
              />
            </div>
          )}

          {/* Предпросмотр */}
          {selected && (
            <div className="flex flex-col gap-2">
              {previewLoading ? (
                <Skeleton className="h-28 rounded-lg" />
              ) : previewErr ? (
                <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-light/40 px-3 py-3 text-sm text-warning">
                  {previewErr}
                </div>
              ) : preview ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("previewTitle")}
                  </span>
                  <div className="flex flex-col divide-y divide-border">
                    {preview.items.map((it, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-3 py-1.5 text-sm"
                      >
                        <span className="min-w-0 flex-1">{it.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          ×{it.qty}
                        </span>
                        <span className="shrink-0 tabular-nums font-medium">
                          {formatSum(it.amountSum, locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                    <span>{t("totalLabel")}</span>
                    <span className="tabular-nums">
                      {formatSum(preview.totalSum, locale)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Дополнительно (текст-блоки PDF) */}
          {selected && preview && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    showAdvanced && "rotate-180"
                  )}
                />
                {t("advanced")}
              </button>
              {showAdvanced && (
                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  {(
                    [
                      ["didoxWarning", didoxWarning, setDidoxWarning],
                      ["partialMonthNote", partialMonthNote, setPartialMonthNote],
                      ["paymentLkBlock", paymentLkBlock, setPaymentLkBlock],
                    ] as const
                  ).map(([key, value, setter]) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        {t(`fields.${key}`)}
                      </Label>
                      <textarea
                        value={value}
                        maxLength={1000}
                        rows={2}
                        onChange={(e) => setter(e.target.value)}
                        className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            disabled={!preview || creating}
            onClick={() => void create()}
            className="gap-2"
          >
            {creating ? (
              <Spinner className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
            {t("create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
