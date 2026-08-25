"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Invoice } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { invoicesApi, SessionExpiredError } from "@/lib/api-authed";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { invoiceStatusStyle, formatSum, downloadBlob } from "./invoice-format";

/** Страница сводного счёта: реквизиты, позиции, итог, PDF/онлайн */
export function InvoicePage({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("Invoices");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    invoicesApi
      .get(invoiceId)
      .then(setInvoice)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- методы стабильны
  }, [invoiceId]);

  useEffect(() => load(), [load]);

  const fmtDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(iso))
      : "—";

  async function download() {
    if (!invoice) return;
    setDownloading(true);
    try {
      const blob = await invoicesApi.pdfBlob(invoice.id);
      downloadBlob(blob, `${invoice.number}.pdf`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1602")
        toast.error(t("pdfNotReady"));
      else toast.error(t("genericError"));
    } finally {
      setDownloading(false);
    }
  }

  if (!invoice) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-52 rounded-lg" />
      </div>
    );
  }

  const period =
    invoice.periodFrom && invoice.periodTo
      ? `${fmtDate(invoice.periodFrom)} – ${fmtDate(invoice.periodTo)}`
      : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        href="/invoices"
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      {/* Шапка */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tabular-nums">{invoice.number}</h1>
            <Badge
              variant="secondary"
              className={cn(invoiceStatusStyle(invoice.status))}
            >
              {t.has(`status.${invoice.status}`)
                ? t(`status.${invoice.status}`)
                : invoice.status}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {invoice.clientName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {invoice.publicUrl && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(invoice.publicUrl!, "_blank")}
            >
              <ExternalLink className="size-4" />
              {t("openOnline")}
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? (
              <Spinner className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
            {t("downloadPdf")}
          </Button>
        </div>
      </div>

      {/* Реквизиты */}
      <section className="grid gap-3 rounded-lg border border-border p-5 sm:grid-cols-2">
        {(
          [
            [t("colDate"), fmtDate(invoice.date)],
            [t("colDue"), fmtDate(invoice.dueDate)],
            ...(period ? [[t("period"), period] as [string, string]] : []),
            [
              t("sourceInvoices"),
              invoice.sourceInvoiceNumbers.join(", ") || "—",
            ],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <span className="text-sm tabular-nums">{value}</span>
          </div>
        ))}
      </section>

      {/* Позиции */}
      <section className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colService")}</TableHead>
              <TableHead className="text-right">{t("colQty")}</TableHead>
              <TableHead className="text-right">{t("colPrice")}</TableHead>
              <TableHead className="text-right">{t("colAmount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((it, i) => (
              <TableRow key={i}>
                <TableCell className="max-w-80">
                  <span className="block">{it.name}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {it.qty}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {formatSum(it.priceSum, locale)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                  {formatSum(it.amountSum, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-base font-semibold">
          <span>{t("totalLabel")}</span>
          <span className="tabular-nums">{formatSum(invoice.totalSum, locale)}</span>
        </div>
      </section>
    </div>
  );
}
