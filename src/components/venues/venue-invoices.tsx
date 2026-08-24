"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { IikoInvoice } from "@/lib/api";
import { iikoPartnerApi } from "@/lib/api-authed";
import { useRouter } from "@/i18n/navigation";
import {
  invoiceStatusStyle,
  formatAmount,
} from "@/components/iiko-partner/invoice-format";

/** Счета заведения (фильтр по clientId) — на странице заведения */
export function VenueInvoices({ clientId }: { clientId: string }) {
  const t = useTranslations("IikoPartner.invoices");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<IikoInvoice[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    iikoPartnerApi.invoices
      .list({ clientId, limit: 50, sort: "issueDate:desc" })
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const formatDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(`${iso}T00:00:00`))
      : "—";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
          <FileText className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("venueInvoicesTitle")}
        </h4>
        {items && items.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {items.length}
          </span>
        )}
      </div>

      {!items ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("venueInvoicesEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colNumber")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("colIssueDate")}</TableHead>
                <TableHead className="text-right">{t("colAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((inv) => (
                <TableRow
                  key={inv.id}
                  onClick={() => router.push(`/iiko-partner/invoices/${inv.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs">
                    {inv.invoiceNumber}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={invoiceStatusStyle(inv.status)}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(inv.issueDate)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatAmount(inv.amountMinor, inv.currency, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
