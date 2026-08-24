"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ExternalLink,
  FileText,
  RefreshCw,
  Store,
} from "lucide-react";
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
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { IikoInvoice } from "@/lib/api";
import { iikoPartnerApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { invoiceStatusStyle, formatAmount } from "./invoice-format";

/** Позиция счёта из модалки invoice-info (портал даёт произвольные колонки) */
interface InvoiceItem {
  name?: string;
  price?: string;
  qty?: string;
  amount?: string;
  discount?: string;
  total?: string;
  [k: string]: string | undefined;
}

/** Страница счёта: реквизиты, привязанное заведение, позиции */
export function InvoicePage({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("IikoPartner.invoices");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage =
    can(PERMISSIONS.iikoInvoicesManage) ||
    can(PERMISSIONS.iikoPartnerInvoicesManage);

  const [invoice, setInvoice] = useState<IikoInvoice | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (refresh = false) => {
      iikoPartnerApi.invoices
        .get(invoiceId, refresh)
        .then(setInvoice)
        .catch((e) => {
          if (e instanceof SessionExpiredError) router.replace("/login");
          else {
            toast.error(t("notFound"));
            router.replace("/iiko-partner?tab=invoices");
          }
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/router стабильны по смыслу
    [invoiceId]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await iikoPartnerApi.invoices.get(invoiceId, true);
      setInvoice(r);
      toast.success(t("cardRefreshed"));
    } catch {
      toast.error(t("syncError"));
    } finally {
      setRefreshing(false);
    }
  }

  const formatDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(`${iso}T00:00:00`))
      : "—";

  if (!invoice) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-20 rounded-lg animate-in fade-in duration-300" />
        <Skeleton className="h-24 rounded-lg animate-in fade-in duration-300" />
        <Skeleton className="h-64 rounded-lg animate-in fade-in duration-300" />
      </div>
    );
  }

  const card = (invoice.card ?? null) as {
    payerName?: string;
    payerUid?: string;
    items?: InvoiceItem[];
    subscription?: Record<string, string>;
  } | null;
  const items = card?.items ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 duration-450 animate-in fade-in">
      <Link
        href="/iiko-partner?tab=invoices"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("backToList")}
      </Link>

      {/* Шапка */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-light">
            <FileText className="size-6 text-primary" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="break-words font-mono text-2xl font-bold">
              {invoice.invoiceNumber}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className={invoiceStatusStyle(invoice.status)}>
                {invoice.status}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-secondary text-muted-foreground"
              >
                {t(`kind.${invoice.kind}`)}
              </Badge>
              {!invoice.active && (
                <Badge variant="secondary" className="text-muted-foreground">
                  {t("removed")}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-2xl font-bold tabular-nums">
            {formatAmount(invoice.amountMinor, invoice.currency, locale)}
          </span>
          {invoice.invoiceId && (
            <a
              href={`https://pp.iiko.ru/en/invoices/edit/${invoice.invoiceId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <ExternalLink className="size-3" />
              {t("openOnPortal")}
            </a>
          )}
        </div>
      </div>

      {/* Реквизиты + заведение */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Building2 className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("requisites")}
            </h4>
          </div>
          <dl className="flex flex-col gap-1.5 text-sm">
            {(
              [
                [t("colEntity"), invoice.legalEntityName],
                [t("taxId"), invoice.legalEntityTaxId],
                [t("endCustomer"), invoice.endCustomer],
                [t("partnerLabel"), invoice.partner],
                [t("colIssueDate"), formatDate(invoice.issueDate)],
                [t("dueDate"), formatDate(invoice.dueDate)],
              ] as const
            )
              .filter(([, v]) => v && v !== "—")
              .map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
          </dl>
        </section>

        <div className="flex flex-col gap-4">
          {invoice.venue && (
            <Link
              href={`/venues/${invoice.venue.id}`}
              className="group flex items-center gap-2.5 rounded-lg border border-border p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light">
                <Store className="size-4.5 text-primary" strokeWidth={1.75} />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-xs text-muted-foreground">{t("colVenue")}</span>
                <span className="truncate font-medium">{invoice.venue.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {invoice.venue.uid}
                </span>
              </div>
              <ChevronRight className="ms-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}

          {invoice.description && (
            <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("descriptionLabel")}
              </h4>
              <p className="text-sm leading-relaxed break-words text-muted-foreground">
                {invoice.description}
              </p>
            </section>
          )}

          {card?.payerName && (
            <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("payer")}
              </h4>
              <span className="text-sm font-medium">{card.payerName}</span>
              {card.payerUid && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {card.payerUid}
                </span>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Позиции */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("itemsLabel")}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            disabled={refreshing}
            onClick={() => void refresh()}
            className="gap-1.5"
          >
            {refreshing ? (
              <Spinner className="size-3.5" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {t("refresh")}
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {t("cardEmpty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("itemName")}</TableHead>
                  <TableHead className="text-right">{t("itemPrice")}</TableHead>
                  <TableHead className="text-right">{t("itemQty")}</TableHead>
                  <TableHead className="text-right">{t("itemDiscount")}</TableHead>
                  <TableHead className="text-right">{t("itemTotal")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => {
                  const vals = Object.values(item).filter(
                    (v): v is string => v != null
                  );
                  // Портал: [название, цена, кол-во, сумма, скидка%, итог]
                  const name = item.name ?? vals[0] ?? "";
                  const price = item.price ?? vals[1] ?? "";
                  const qty = item.qty ?? vals[2] ?? "";
                  const discount = item.discount ?? vals[4] ?? "";
                  const total = item.total ?? vals[vals.length - 1] ?? "";
                  return (
                    <TableRow key={i}>
                      <TableCell className="max-w-72 font-medium">
                        <span className="block truncate">{name}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {price}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {qty}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {discount}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {total}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {!canManage && null}
      </section>
    </div>
  );
}
