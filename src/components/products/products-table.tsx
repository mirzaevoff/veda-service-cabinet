"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Pencil,
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
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/components/common/current-user-provider";
import {
  ActiveFilterChips,
  FiltersDialog,
  type ActiveFilter,
} from "@/components/common/filters-dialog";
import {
  SortableTableHead,
  type SortValue,
} from "@/components/common/sortable-table-head";
import { ProductFormDialog } from "./product-form-dialog";
import type {
  Product,
  ProductCurrency,
  ProductType,
  ProductsPage,
} from "@/lib/api";
import { productsApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TYPE_FILTERS: (ProductType | "any")[] = [
  "any",
  "iikoSaaS",
  "iikoCloud",
  "other",
];

function formatMoney(amount: number) {
  return amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export function ProductsTable() {
  const t = useTranslations("Products");
  const tt = useTranslations("Products.types");
  const tc = useTranslations("Common");
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.productsManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [type, setType] = useState<ProductType | "any">("any");
  const [currency, setCurrency] = useState<ProductCurrency | "any">("any");
  const [activeOnly, setActiveOnly] = useState<"any" | "true" | "false">("any");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const debouncedMin = useDebouncedValue(minPrice, 500);
  const debouncedMax = useDebouncedValue(maxPrice, 500);
  const [sort, setSort] = useState<SortValue>("name:asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProductsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при смене фильтров
    setPage(1);
  }, [debouncedSearch, type, currency, activeOnly, debouncedMin, debouncedMax, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await productsApi.list({
        page,
        search: debouncedSearch || undefined,
        type: type === "any" ? undefined : type,
        currency: currency === "any" ? undefined : currency,
        isActive: activeOnly === "any" ? undefined : activeOnly === "true",
        minPrice: debouncedMin ? Number(debouncedMin) : undefined,
        maxPrice: debouncedMax ? Number(debouncedMax) : undefined,
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
  }, [page, debouncedSearch, type, currency, activeOnly, debouncedMin, debouncedMax, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await осознанный
    void load();
  }, [load]);

  async function remove() {
    if (!deleting) return;
    try {
      await productsApi.remove(deleting.id);
      toast.success(t("deleted"));
      setDeleting(null);
      void load();
    } catch {
      toast.error(t("form.genericError"));
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const activeFilters: ActiveFilter[] = [];
  if (type !== "any") {
    activeFilters.push({
      key: "type",
      label: `${t("columnType")}: ${tt(type)}`,
      onRemove: () => setType("any"),
    });
  }
  if (currency !== "any") {
    activeFilters.push({
      key: "currency",
      label: `${t("filterCurrency")}: ${t(`form.currency.${currency}`)}`,
      onRemove: () => setCurrency("any"),
    });
  }
  if (activeOnly !== "any") {
    activeFilters.push({
      key: "active",
      label: activeOnly === "true" ? t("onlyActive") : t("onlyInactive"),
      onRemove: () => setActiveOnly("any"),
    });
  }
  if (minPrice || maxPrice) {
    activeFilters.push({
      key: "price",
      label: `${t("filterPrice")}: ${minPrice || "0"}—${maxPrice || "∞"}`,
      onRemove: () => {
        setMinPrice("");
        setMaxPrice("");
      },
    });
  }

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

        <FiltersDialog
          active={activeFilters}
          onReset={() => {
            setType("any");
            setCurrency("any");
            setActiveOnly("any");
            setMinPrice("");
            setMaxPrice("");
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("columnType")}
            </Label>
            <Select
              value={type}
              items={Object.fromEntries(
                TYPE_FILTERS.map((v) => [v, v === "any" ? t("anyType") : tt(v)])
              )}
              onValueChange={(v) => setType(v as ProductType | "any")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "any" ? t("anyType") : tt(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("filterCurrency")}
            </Label>
            <Select
              value={currency}
              items={{
                any: t("anyCurrency"),
                USD: t("form.currency.USD"),
                UZS: t("form.currency.UZS"),
              }}
              onValueChange={(v) => setCurrency(v as ProductCurrency | "any")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("anyCurrency")}</SelectItem>
                <SelectItem value="USD">{t("form.currency.USD")}</SelectItem>
                <SelectItem value="UZS">{t("form.currency.UZS")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("filterActive")}
            </Label>
            <Select
              value={activeOnly}
              items={{
                any: t("anyActive"),
                true: t("onlyActive"),
                false: t("onlyInactive"),
              }}
              onValueChange={(v) => setActiveOnly(v as "any" | "true" | "false")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("anyActive")}</SelectItem>
                <SelectItem value="true">{t("onlyActive")}</SelectItem>
                <SelectItem value="false">{t("onlyInactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("filterPrice")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                value={minPrice}
                placeholder={t("priceFrom")}
                onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ""))}
                className="min-w-0 flex-1 tabular-nums"
              />
              <span className="text-muted-foreground">—</span>
              <Input
                inputMode="numeric"
                value={maxPrice}
                placeholder={t("priceTo")}
                onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
                className="min-w-0 flex-1 tabular-nums"
              />
            </div>
            <span className="text-xs text-muted-foreground">{t("priceHint")}</span>
          </div>
        </FiltersDialog>

        {data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("total", { count: data.total })} · {t("rate", {
              rate: formatMoney(data.usdRate),
            })}
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

      <ActiveFilterChips active={activeFilters} />

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <Package className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch ? t("emptySearch") : t("empty")}
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
                <SortableTableHead field="type" sort={sort} onSort={setSort}>
                  {t("columnType")}
                </SortableTableHead>
                <SortableTableHead
                  field="price"
                  sort={sort}
                  onSort={setSort}
                  align="end"
                >
                  {t("columnPrice")}
                </SortableTableHead>
                <TableHead>{t("columnSpic")}</TableHead>
                {canManage && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((product) => (
                <TableRow
                  key={product.id}
                  className={cn(!product.isActive && "opacity-60")}
                >
                  <TableCell className="max-w-72">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{product.name}</span>
                      {!product.isActive && (
                        <Badge variant="secondary" className="shrink-0">
                          {t("inactive")}
                        </Badge>
                      )}
                    </div>
                    {product.description && (
                      <div className="truncate text-xs text-muted-foreground">
                        {product.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tt(product.type)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div className="font-medium">
                      {product.currency === "USD"
                        ? `${formatMoney(product.price)} $`
                        : `${formatMoney(product.price)} ${t("form.currency.UZS")}`}
                    </div>
                    {product.currency === "USD" && (
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(product.priceUzs)} {t("form.currency.UZS")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {product.spic || "—"}
                    {product.packageCode && (
                      <div className="text-xs">{product.packageCode}</div>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={tc("edit")}
                          onClick={() => setEditing(product)}
                          className="text-muted-foreground"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={tc("delete")}
                          onClick={() => setDeleting(product)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
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

      <ProductFormDialog
        open={creating || !!editing}
        product={editing}
        usdRate={data?.usdRate ?? 0}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          void load();
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteConfirmTitle", { name: deleting?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
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
