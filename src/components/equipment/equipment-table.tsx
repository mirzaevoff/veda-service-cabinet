"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EquipmentFormDialog } from "./equipment-form-dialog";
import type { DictionaryItem, Equipment, EquipmentPage, Office } from "@/lib/api";
import { equipmentApi, locationsApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { formatRelativeTime } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";

const ALL = "__all__";

export function EquipmentTable() {
  const t = useTranslations("Equipment");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.equipmentManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [officeId, setOfficeId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [statusId, setStatusId] = useState(ALL);
  const [page, setPage] = useState(1);

  const [offices, setOffices] = useState<Office[]>([]);
  const [categories, setCategories] = useState<DictionaryItem[]>([]);
  const [statuses, setStatuses] = useState<DictionaryItem[]>([]);

  const [data, setData] = useState<EquipmentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayed(loading && !data);

  const [editing, setEditing] = useState<Equipment | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Equipment | null>(null);

  useEffect(() => {
    void locationsApi.offices().then(setOffices).catch(() => {});
    void equipmentApi.categories().then(setCategories).catch(() => {});
    void equipmentApi.statuses().then(setStatuses).catch(() => {});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при смене фильтров
    setPage(1);
  }, [debouncedSearch, officeId, categoryId, statusId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await equipmentApi.list({
        page,
        search: debouncedSearch || undefined,
        officeId: officeId === ALL ? undefined : officeId,
        categoryId: categoryId === ALL ? undefined : categoryId,
        statusId: statusId === ALL ? undefined : statusId,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, officeId, categoryId, statusId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function remove() {
    if (!deleting) return;
    try {
      await equipmentApi.remove(deleting.id);
      toast.success(t("deleted"));
      setDeleting(null);
      void load();
    } catch {
      toast.error(t("genericError"));
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const filterSelect = (
    value: string,
    set: (v: string) => void,
    allLabel: string,
    items: { id: string; name: string }[]
  ) => (
    <Select
      value={value}
      items={{ [ALL]: allLabel, ...Object.fromEntries(items.map((i) => [i.id, i.name])) }}
      onValueChange={(v) => set(v ?? ALL)}
    >
      <SelectTrigger className="h-9 w-auto min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {items.map((i) => (
          <SelectItem key={i.id} value={i.id}>
            {i.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-64 pl-9"
          />
        </div>
        {filterSelect(officeId, setOfficeId, t("allOffices"), offices)}
        {filterSelect(categoryId, setCategoryId, t("allCategories"), categories)}
        {filterSelect(statusId, setStatusId, t("allStatuses"), statuses)}
        {canManage && (
          <div className="ms-auto">
            <Button onClick={() => setCreating(true)} className="gap-2">
              <Plus className="size-4" />
              {t("add")}
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
            <Package className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch || officeId !== ALL || categoryId !== ALL || statusId !== ALL
              ? t("emptySearch")
              : t("empty")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border duration-450 animate-in fade-in slide-in-from-bottom-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colResponsible")}</TableHead>
                <TableHead>{t("colLocation")}</TableHead>
                <TableHead>{t("colCategory")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((eq) => (
                <TableRow
                  key={eq.id}
                  onClick={() => canManage && setEditing(eq)}
                  className={canManage ? "cursor-pointer" : undefined}
                >
                  <TableCell className="max-w-64 font-medium">
                    <span className="block truncate">{eq.name}</span>
                    {(eq.serialNumber || eq.inventoryNumber) && (
                      <span className="block truncate text-xs text-muted-foreground tabular-nums">
                        {[eq.serialNumber && `S/N ${eq.serialNumber}`, eq.inventoryNumber && `№ ${eq.inventoryNumber}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {eq.responsible?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {eq.office?.name ?? "—"}
                    {eq.department && (
                      <span className="text-muted-foreground/70"> · {eq.department.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {eq.category?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {eq.status ? (
                      <Badge variant="secondary">{eq.status.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tc("delete")}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleting(eq);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  )}
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

      {data && data.total > 0 && (
        <span className="text-center text-xs text-muted-foreground tabular-nums">
          {t("total", { count: data.total })}
          {data.items[0] && ` · ${formatRelativeTime(data.items[0].createdAt, locale)}`}
        </span>
      )}

      <EquipmentFormDialog
        equipment={editing}
        open={!!editing || creating}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={load}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmText", { name: deleting?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void remove()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
