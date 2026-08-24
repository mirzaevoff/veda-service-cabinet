"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350);
  const [options, setOptions] = useState<LegalEntity[] | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("linkTitle")}</DialogTitle>
          <DialogDescription>{t("linkHint")}</DialogDescription>
        </DialogHeader>
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
              {options.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void link(entity.id)}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
                >
                  <span className="min-w-0 truncate font-medium">{entity.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {entity.taxId}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
