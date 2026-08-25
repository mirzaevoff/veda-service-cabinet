"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { GenerateInvoiceDialog } from "@/components/invoices/generate-invoice-dialog";
import { invoiceStatusStyle, formatSum } from "@/components/invoices/invoice-format";
import type { Invoice } from "@/lib/api";
import { invoicesApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Счета на оплату этого ЮЛ (видно при праве invoices.view) */
export function EntityBills({
  entityId,
  entityName,
}: {
  entityId: string;
  entityName: string;
}) {
  const t = useTranslations("Invoices");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.invoicesManage);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    invoicesApi
      .list({ legalEntityId: entityId, limit: 20 })
      .then((page) => !cancelled && setInvoices(page.items))
      .catch(() => !cancelled && setInvoices([]));
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  useEffect(() => load(), [load]);

  const fmtDate = (iso: string) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(iso))
      : "—";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
            <ReceiptText className="size-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("sectionTitle")}
          </h4>
          {invoices && invoices.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {invoices.length}
            </span>
          )}
        </div>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setGenerating(true)}
          >
            <FileText className="size-3.5" />
            {t("generate")}
          </Button>
        )}
      </div>

      {!invoices ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-8 text-center duration-300 animate-in fade-in">
          <div className="flex size-12 items-center justify-center rounded-lg bg-accent-light">
            <ReceiptText className="size-6 text-primary" strokeWidth={1.75} />
          </div>
          <span className="text-sm text-muted-foreground">{t("emptyEntity")}</span>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setGenerating(true)}
            >
              <FileText className="size-3.5" />
              {t("generate")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2 transition-colors hover:border-primary/40"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm font-medium tabular-nums">
                  {inv.number}
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0", invoiceStatusStyle(inv.status))}
                  >
                    {t.has(`status.${inv.status}`)
                      ? t(`status.${inv.status}`)
                      : inv.status}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {fmtDate(inv.date)}
                </span>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatSum(inv.totalSum, locale)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <GenerateInvoiceDialog
        open={generating}
        onClose={() => setGenerating(false)}
        legalEntity={{ id: entityId, name: entityName }}
        onCreated={(inv) => router.push(`/invoices/${inv.id}`)}
      />
    </section>
  );
}
