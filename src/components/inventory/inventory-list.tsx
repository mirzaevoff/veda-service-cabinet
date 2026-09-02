"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ClipboardList, Plus } from "lucide-react";
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
import { CreateAuditDialog } from "./create-audit-dialog";
import { auditStatusStyle } from "./inventory-format";
import type { InventoryPage } from "@/lib/api";
import { inventoryApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDelayed } from "@/hooks/use-delayed";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function InventoryList() {
  const t = useTranslations("Inventory");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.inventoryManage);

  const [page, setPage] = useState(1);
  const [data, setData] = useState<InventoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const showSkeleton = useDelayed(loading && !data);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await inventoryApi.list({ page });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso)
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        {data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("total", { count: data.total })}
          </span>
        )}
        {canManage && (
          <div className="ms-auto">
            <Button onClick={() => setCreating(true)} className="gap-2">
              <Plus className="size-4" />
              {t("newAudit")}
            </Button>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <ClipboardList className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          {canManage && (
            <Button onClick={() => setCreating(true)} variant="outline" className="gap-2">
              <Plus className="size-4" />
              {t("newAudit")}
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border duration-450 animate-in fade-in slide-in-from-bottom-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colLocation")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="text-right">{t("colProgress")}</TableHead>
                <TableHead className="text-right">{t("colDiscrepancies")}</TableHead>
                <TableHead className="text-right">{t("colCreated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((a) => (
                <TableRow
                  key={a.id}
                  onClick={() => router.push(`/inventory/${a.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">
                    {a.office.name}
                    {a.department && (
                      <span className="text-muted-foreground"> · {a.department.name}</span>
                    )}
                    {a.createdBy && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {a.createdBy.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn(auditStatusStyle(a.status))}>
                      {t(`status.${a.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {a.counts.checked}/{a.counts.total}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.counts.discrepancies > 0 ? (
                      <span className="font-medium text-warning">{a.counts.discrepancies}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {fmtDate(a.createdAt)}
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

      <CreateAuditDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(a) => router.push(`/inventory/${a.id}`)}
      />
    </div>
  );
}
