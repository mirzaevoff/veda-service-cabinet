"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, FileText, Plus, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/components/common/current-user-provider";
import {
  SortableTableHead,
  type SortValue,
} from "@/components/common/sortable-table-head";
import { GenerateInvoiceDialog } from "./generate-invoice-dialog";
import { invoiceStatusStyle, formatSum } from "./invoice-format";
import type { InvoicesPage } from "@/lib/api";
import { invoicesApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDelayed } from "@/hooks/use-delayed";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";

export function InvoicesList() {
  const t = useTranslations("Invoices");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.invoicesManage);

  const [sort, setSort] = useState<SortValue>("date:desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InvoicesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const showSkeleton = useDelayed(loading && !data);

  const fmtDate = (iso: string) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(iso))
      : "—";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoicesApi.list({ page, sort: sort || undefined });
      if (result.items.length === 0 && result.page > 1) {
        setPage(1);
        return;
      }
      setData(result);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- методы стабильны
  }, [page, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await осознанный
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        {data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("total", { count: data.total })}
          </span>
        )}
        {canManage && (
          <div className="ms-auto">
            <Button onClick={() => setGenerating(true)} className="gap-2">
              <Plus className="size-4" />
              {t("generate")}
            </Button>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <ReceiptText className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          {canManage && (
            <Button onClick={() => setGenerating(true)} variant="outline" className="gap-2">
              <FileText className="size-4" />
              {t("generate")}
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border duration-450 animate-in fade-in slide-in-from-bottom-2">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead field="number" sort={sort} onSort={setSort}>
                  {t("colNumber")}
                </SortableTableHead>
                <TableHead>{t("colClient")}</TableHead>
                <SortableTableHead field="date" sort={sort} onSort={setSort}>
                  {t("colDate")}
                </SortableTableHead>
                <TableHead>{t("colDue")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <SortableTableHead field="totalTiyin" sort={sort} onSort={setSort} align="end">
                  {t("colTotal")}
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((inv) => (
                <TableRow
                  key={inv.id}
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium tabular-nums">{inv.number}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {inv.clientName}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {fmtDate(inv.date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {fmtDate(inv.dueDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn(invoiceStatusStyle(inv.status))}>
                      {t.has(`status.${inv.status}`)
                        ? t(`status.${inv.status}`)
                        : inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                    {formatSum(inv.totalSum, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            aria-label={tc("prevPage")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            aria-label={tc("nextPage")}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      <GenerateInvoiceDialog
        open={generating}
        onClose={() => setGenerating(false)}
        onCreated={(inv) => router.push(`/invoices/${inv.id}`)}
      />
    </div>
  );
}
