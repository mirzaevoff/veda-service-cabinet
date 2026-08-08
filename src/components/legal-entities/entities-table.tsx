"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Building2, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { EntityFormDialog } from "./entity-form-dialog";
import { EntityDrawer } from "./entity-drawer";
import { directorName } from "./entity-requisites";
import type { LegalEntity, Page } from "@/lib/api";
import { legalEntitiesApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { formatRelativeTime } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";

export function EntitiesTable() {
  const t = useTranslations("LegalEntities");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.legalEntitiesManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [sort, setSort] = useState<SortValue>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<LegalEntity> | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при поиске
    setPage(1);
  }, [debouncedSearch, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await legalEntitiesApi.list({
        page,
        search: debouncedSearch || undefined,
        sort: sort || undefined,
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/tc нестабильны, методы стабильны
  }, [page, debouncedSearch, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await осознанный
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-72 pl-9"
          />
        </div>
        {data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("total", { count: data.total })}
          </span>
        )}
        {canManage && (
          <div className="ms-auto">
            <Button onClick={() => setCreating(true)} className="gap-2">
              <Plus className="size-4" />
              {t("create")}
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
            <Building2 className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch ? t("emptySearch") : t("emptyTitle")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border duration-450 animate-in fade-in slide-in-from-bottom-2">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead field="name" sort={sort} onSort={setSort}>
                  {t("columnName")}
                </SortableTableHead>
                <SortableTableHead
                  field="establishment"
                  sort={sort}
                  onSort={setSort}
                >
                  {t("establishment")}
                </SortableTableHead>
                <SortableTableHead field="taxId" sort={sort} onSort={setSort}>
                  {t("columnTaxId")}
                </SortableTableHead>
                <TableHead>{t("columnDirector")}</TableHead>
                <SortableTableHead
                  field="createdAt"
                  sort={sort}
                  onSort={setSort}
                  align="end"
                >
                  {t("columnAdded")}
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((entity) => (
                <TableRow
                  key={entity.id}
                  onClick={() => setSelectedId(entity.id)}
                  className="cursor-pointer"
                >
                  <TableCell className="max-w-72 truncate font-medium">
                    {entity.name}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {entity.establishment || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {entity.taxId}
                  </TableCell>
                  <TableCell className="max-w-60 truncate text-muted-foreground">
                    {directorName(entity.director)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {formatRelativeTime(entity.createdAt, locale)}
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

      <EntityFormDialog
        open={creating}
        entity={null}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          void load();
        }}
      />

      <EntityDrawer
        entityId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
