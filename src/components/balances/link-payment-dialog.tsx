"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, type LedgerEntry, type LegalEntity } from "@/lib/api";
import { balancesApi, legalEntitiesApi } from "@/lib/api-authed";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { formatLedgerAmount } from "./ledger-format";

/** Привязка нераспознанного пополнения к ЮЛ */
export function LinkPaymentDialog({
  entry,
  onClose,
  onLinked,
}: {
  entry: LedgerEntry | null;
  onClose: () => void;
  onLinked: () => void;
}) {
  const t = useTranslations("Transactions");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350);
  const [options, setOptions] = useState<LegalEntity[] | null>(null);
  const [busy, setBusy] = useState(false);

  // При открытии предзаполняем поиск ИНН плательщика — совпадающее ЮЛ всплывёт первым
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- инициализация поиска при открытии
    setQ(entry?.payer?.inn ?? "");
    setOptions(null);
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    legalEntitiesApi
      .list({ search: debounced || undefined, limit: 20 })
      .then((page) => !cancelled && setOptions(page.items))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [entry, debounced]);

  async function link(legalEntityId: string) {
    if (!entry) return;
    setBusy(true);
    try {
      await balancesApi.link(entry.id, legalEntityId);
      toast.success(t("linked"));
      onLinked();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1501") toast.error(t("errors.ER1501"));
      else toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));

  const inn = entry?.payer?.inn;

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("linkTitle")}</DialogTitle>
          <DialogDescription>{t("linkHint")}</DialogDescription>
        </DialogHeader>

        {entry && (
          <div className="flex flex-col gap-4">
            {/* Детали пополнения */}
            <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-secondary/40 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t("colAmount")}</span>
                <span className="text-lg font-bold tabular-nums text-success">
                  {formatLedgerAmount(entry, locale)}
                </span>
              </div>
              <dl className="flex flex-col gap-1 text-sm">
                {(
                  [
                    [t("payerName"), entry.payer?.name],
                    [t("payerInn"), entry.payer?.inn],
                    [t("payerAccount"), entry.payer?.account],
                    [t("colDate"), formatDate(entry.createdAt)],
                    [t("purpose"), entry.comment],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="min-w-0 break-words text-right font-medium tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>

            {/* Выбор ЮЛ */}
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
                <div className="-mr-1 flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
                  {options.map((entity) => {
                    const match = !!inn && entity.taxId === inn;
                    return (
                      <button
                        key={entity.id}
                        type="button"
                        disabled={busy}
                        onClick={() => void link(entity.id)}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40",
                          match
                            ? "border-primary/50 bg-accent-light/40"
                            : "border-border"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 truncate font-medium">
                            {entity.name}
                          </span>
                          {match && (
                            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-primary">
                              {t("innMatch")}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {entity.taxId}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
