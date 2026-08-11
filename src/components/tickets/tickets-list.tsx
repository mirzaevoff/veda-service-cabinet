"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/components/common/current-user-provider";
import {
  ActiveFilterChips,
  FiltersDialog,
  type ActiveFilter,
} from "@/components/common/filters-dialog";
import { SortSelect, type SortOption } from "@/components/common/sort-select";
import { TicketStatusBadge } from "./ticket-status-badge";
import { SeverityBadge, SlaIndicator } from "./severity-badge";
import { useTicketListEvents } from "@/hooks/use-ticket-socket";
import type {
  LegalEntity,
  Page,
  Ticket,
  TicketCategory,
  TicketSeverity,
  TicketStatus,
} from "@/lib/api";
import {
  SessionExpiredError,
  legalEntitiesApi,
  severitiesApi,
  ticketsApi,
} from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { formatRelativeTime, pickLocalized } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { getCached, setCached } from "@/lib/list-cache";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function TicketsList() {
  const t = useTranslations("Tickets.list");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, can } = useCurrentUser();

  const isStaff = can(PERMISSIONS.ticketsList);

  // Staff по умолчанию видит все обращения, ?scope=mine — только свои
  const scope = isStaff
    ? searchParams.get("scope") === "mine"
      ? "mine"
      : "all"
    : "mine";
  const status = (searchParams.get("status") ?? "") as TicketStatus | "";
  const categoryId = searchParams.get("category") ?? "";
  const entityId = searchParams.get("entity") ?? "";
  const severityId = searchParams.get("severity") ?? "";
  const breached = searchParams.get("breached") === "1";
  const unclaimed = searchParams.get("unclaimed") === "1";
  const urlSearch = searchParams.get("q") ?? "";
  // Дефолт: очередь суппорта — по дедлайну, свои обращения — по активности
  const sort = searchParams.get("sort") ?? (scope === "all" ? "deadline:asc" : "lastMessageAt:desc");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const cacheKey = `tickets:${scope}:${status}:${categoryId}:${entityId}:${severityId}:${breached}:${unclaimed}:${sort}:${urlSearch}:${page}`;
  const [data, setData] = useState<Page<Ticket> | null>(
    () => getCached<Page<Ticket>>(cacheKey) ?? null
  );
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<TicketCategory[]>(
    () => getCached<TicketCategory[]>("ticket-categories") ?? []
  );
  const [entities, setEntities] = useState<LegalEntity[]>(
    () => getCached<LegalEntity[]>("ticket-filter-entities") ?? []
  );
  const showSkeleton = useDelayed(loading && !data);

  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebouncedValue(search, 400);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    setParams({ q: debouncedSearch || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams пересоздаётся на каждый searchParams
  }, [debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ticketsApi.list({
        page,
        search: urlSearch || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
        legalEntityId: entityId || undefined,
        all: scope === "all" || undefined,
        severityId: (scope === "all" && severityId) || undefined,
        breached: (scope === "all" && breached) || undefined,
        unclaimed: (scope === "all" && unclaimed) || undefined,
        sort,
      });
      // Страница опустела (фильтр/удаление) — откат на первую
      if (result.items.length === 0 && result.page > 1) {
        setParams({ page: null });
        return;
      }
      setData(result);
      setCached(cacheKey, result);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/tc нестабильны, методы стабильны
  }, [page, status, categoryId, entityId, scope, severityId, breached, unclaimed, sort, urlSearch]);

  useEffect(() => {
    const cached = getCached<Page<Ticket>>(cacheKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- мгновенный показ кэша до refetch
    if (cached) setData(cached);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    ticketsApi
      .categories()
      .then((cats) => {
        setCategories(cats);
        setCached("ticket-categories", cats);
      })
      .catch(() => {});
  }, []);

  const canListEntities = can(PERMISSIONS.legalEntitiesList);
  useEffect(() => {
    const promise = canListEntities
      ? legalEntitiesApi.list({ limit: 100, sort: "name:asc" }).then((p) => p.items)
      : legalEntitiesApi.my();
    promise
      .then((items) => {
        setEntities(items);
        setCached("ticket-filter-entities", items);
      })
      .catch(() => {});
  }, [canListEntities]);

  const [severities, setSeverities] = useState<TicketSeverity[]>(
    () => getCached<TicketSeverity[]>("ticket-severities") ?? []
  );
  useEffect(() => {
    if (!isStaff) return;
    severitiesApi
      .list()
      .then((items) => {
        setSeverities(items);
        setCached("ticket-severities", items);
      })
      .catch(() => {});
  }, [isStaff]);

  useTicketListEvents({
    onUpdated: (ticket) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === ticket.id ? ticket : item
              ),
            }
          : prev
      );
    },
    onMessage: (message) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === message.ticketId
                  ? { ...item, lastMessageAt: message.createdAt }
                  : item
              ),
            }
          : prev
      );
    },
    onCreated: (ticket) => {
      if (scope !== "all" || page !== 1) return;
      setData((prev) =>
        prev && !prev.items.some((i) => i.id === ticket.id)
          ? { ...prev, total: prev.total + 1, items: [ticket, ...prev.items] }
          : prev
      );
      toast(t("newTicketToast", { subject: ticket.subject }));
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive),
    [categories]
  );

  // Фильтры для модалки: чипы + сброс строятся из одного описания
  const activeFilters: ActiveFilter[] = [];
  if (status) {
    activeFilters.push({
      key: "status",
      label: `${t("filterStatusLabel")}: ${status === "open" ? t("statusOpen") : t("statusClosed")}`,
      onRemove: () => setParams({ status: null, page: null }),
    });
  }
  if (categoryId) {
    const category = activeCategories.find((c) => c.id === categoryId);
    activeFilters.push({
      key: "category",
      label: `${t("filterCategoryLabel")}: ${category ? pickLocalized(category.name, locale) : "—"}`,
      onRemove: () => setParams({ category: null, page: null }),
    });
  }
  if (entityId) {
    const entity = entities.find((e) => e.id === entityId);
    activeFilters.push({
      key: "entity",
      label: `${t("filterEntityLabel")}: ${entity ? entity.establishment || entity.name : "—"}`,
      onRemove: () => setParams({ entity: null, page: null }),
    });
  }
  if (isStaff && scope === "all" && severityId) {
    const severity = severities.find((sev) => sev.id === severityId);
    activeFilters.push({
      key: "severity",
      label: `${t("filterSeverityLabel")}: ${severity ? pickLocalized(severity.name, locale) : "—"}`,
      onRemove: () => setParams({ severity: null, page: null }),
    });
  }
  if (isStaff && scope === "all" && breached) {
    activeFilters.push({
      key: "breached",
      label: t("filterBreached"),
      onRemove: () => setParams({ breached: null, page: null }),
    });
  }
  if (isStaff && scope === "all" && unclaimed) {
    activeFilters.push({
      key: "unclaimed",
      label: t("filterUnclaimed"),
      onRemove: () => setParams({ unclaimed: null, page: null }),
    });
  }

  const sortOptions: SortOption[] = [
    ...(isStaff && scope === "all"
      ? [{ value: "deadline:asc", label: t("sortDeadline") }]
      : []),
    { value: "lastMessageAt:desc", label: t("sortLastMessage") },
    { value: "createdAt:desc", label: t("sortNewest") },
    { value: "createdAt:asc", label: t("sortOldest") },
    { value: "status:asc", label: t("sortStatus") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        {isStaff && (
          <Tabs
            value={scope}
            onValueChange={(v) => setParams({ scope: v === "mine" ? "mine" : null, page: null })}
          >
            <TabsList>
              <TabsTrigger value="all">{t("tabAll")}</TabsTrigger>
              <TabsTrigger value="mine">{t("tabMine")}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-64 pl-9"
          />
        </div>

        <SortSelect
          value={sort}
          options={sortOptions}
          onChange={(next) => setParams({ sort: next, page: null })}
        />

        <FiltersDialog
          active={activeFilters}
          onReset={() =>
            setParams({
              status: null,
              category: null,
              entity: null,
              severity: null,
              breached: null,
              unclaimed: null,
              page: null,
            })
          }
        >
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("filterStatusLabel")}
            </Label>
            <Select
              value={status || "any"}
              items={{
                any: t("anyStatus"),
                open: t("statusOpen"),
                closed: t("statusClosed"),
              }}
              onValueChange={(v) =>
                setParams({ status: v === "any" ? null : (v as string), page: null })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("anyStatus")}</SelectItem>
                <SelectItem value="open">{t("statusOpen")}</SelectItem>
                <SelectItem value="closed">{t("statusClosed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activeCategories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("filterCategoryLabel")}
              </Label>
              <Select
                value={categoryId || "any"}
                items={Object.fromEntries([
                  ["any", t("anyCategory")],
                  ...activeCategories.map((c) => [c.id, pickLocalized(c.name, locale)]),
                ])}
                onValueChange={(v) =>
                  setParams({ category: v === "any" ? null : (v as string), page: null })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyCategory")}</SelectItem>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {pickLocalized(c.name, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {entities.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("filterEntityLabel")}
              </Label>
              <Select
                value={entityId || "any"}
                items={Object.fromEntries([
                  ["any", t("anyEntity")],
                  ...entities.map((e) => [
                    e.id,
                    e.establishment ? `${e.establishment} · ${e.name}` : e.name,
                  ]),
                ])}
                onValueChange={(v) =>
                  setParams({ entity: v === "any" ? null : (v as string), page: null })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyEntity")}</SelectItem>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.establishment ? `${e.establishment} · ${e.name}` : e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isStaff && scope === "all" && severities.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("filterSeverityLabel")}
              </Label>
              <Select
                value={severityId || "any"}
                items={Object.fromEntries([
                  ["any", t("anySeverity")],
                  ...severities.map((sev) => [sev.id, pickLocalized(sev.name, locale)]),
                ])}
                onValueChange={(v) =>
                  setParams({ severity: v === "any" ? null : (v as string), page: null })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anySeverity")}</SelectItem>
                  {severities.map((sev) => (
                    <SelectItem key={sev.id} value={sev.id}>
                      {pickLocalized(sev.name, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isStaff && scope === "all" && (
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={breached}
                  onCheckedChange={(v) =>
                    setParams({ breached: v === true ? "1" : null, page: null })
                  }
                />
                {t("filterBreached")}
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={unclaimed}
                  onCheckedChange={(v) =>
                    setParams({ unclaimed: v === true ? "1" : null, page: null })
                  }
                />
                {t("filterUnclaimed")}
              </label>
            </div>
          )}
        </FiltersDialog>

        {/* Поддержка (tickets.manage) отвечает на обращения, а не создаёт их (ER413) */}
        {!can(PERMISSIONS.ticketsManage) && (
          <div className="ms-auto">
            <Link href="/tickets/new">
              <Button className="gap-2">
                <Plus className="size-4" />
                {t("newTicket")}
              </Button>
            </Link>
          </div>
        )}
      </div>

      <ActiveFilterChips active={activeFilters} />

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <MessagesSquare
              className="size-[26px] text-primary"
              strokeWidth={1.75}
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((ticket, i) => (
            <Link
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
              style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
            >
              <Card
                className={cn(
                  "flex-row items-center gap-4 rounded-lg border-border p-4 transition-colors hover:border-primary/40",
                  ticket.status === "closed" && "opacity-70",
                  ticket.slaBreached &&
                    ticket.status === "open" &&
                    "border-destructive/50 bg-destructive/5"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">
                      {ticket.subject}
                    </span>
                    <TicketStatusBadge status={ticket.status} />
                    {ticket.severity && <SeverityBadge severity={ticket.severity} />}
                    <SlaIndicator ticket={ticket} />
                    {isStaff &&
                      scope === "all" &&
                      ticket.status === "open" &&
                      (ticket.participants?.length ?? 0) === 0 && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t("unclaimedMark")}
                        </span>
                      )}
                  </div>
                  <span className="truncate text-sm text-muted-foreground">
                    {pickLocalized(ticket.category, locale)}
                    {ticket.subcategory && ` · ${pickLocalized(ticket.subcategory, locale)}`}
                    {ticket.legalEntity && (
                      <>
                        {" · "}
                        <Building2 className="inline size-3.5 -translate-y-px" />{" "}
                        {ticket.legalEntity.establishment ||
                          ticket.legalEntity.name}
                      </>
                    )}
                    {scope === "all" && user?.id !== ticket.author.id && (
                      <>
                        {" · "}
                        <UserRound className="inline size-3.5 -translate-y-px" />{" "}
                        {ticket.author.name}
                      </>
                    )}
                  </span>
                </div>
                {(ticket.unreadCount ?? 0) > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.7rem] font-semibold text-primary-foreground tabular-nums duration-300 animate-in zoom-in-75">
                    {ticket.unreadCount}
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatRelativeTime(ticket.lastMessageAt, locale)}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          ))}

          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page <= 1 || loading}
                onClick={() => setParams({ page: String(page - 1) })}
                aria-label={tc("prevPage")}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {t("pageOf", { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setParams({ page: String(page + 1) })}
                aria-label={tc("nextPage")}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
