"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  Plus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { TicketStatusBadge } from "./ticket-status-badge";
import { useTicketListEvents } from "@/hooks/use-ticket-socket";
import type { Page, Ticket, TicketCategory, TicketStatus } from "@/lib/api";
import { SessionExpiredError, ticketsApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { formatRelativeTime } from "@/lib/format";
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

  const scope = searchParams.get("scope") === "all" && isStaff ? "all" : "mine";
  const status = (searchParams.get("status") ?? "") as TicketStatus | "";
  const categoryId = searchParams.get("category") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [data, setData] = useState<Page<Ticket> | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<TicketCategory[]>([]);

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ticketsApi.list({
        page,
        status: status || undefined,
        categoryId: categoryId || undefined,
        all: scope === "all" || undefined,
      });
      // Страница опустела (фильтр/удаление) — откат на первую
      if (result.items.length === 0 && result.page > 1) {
        setParams({ page: null });
        return;
      }
      setData(result);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, status, categoryId, scope, router, setParams, tc]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await осознанный (индикатор загрузки)
    void load();
  }, [load]);

  useEffect(() => {
    ticketsApi.categories().then(setCategories).catch(() => {});
  }, []);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        {isStaff && (
          <Tabs
            value={scope}
            onValueChange={(v) => setParams({ scope: v === "all" ? "all" : null, page: null })}
          >
            <TabsList>
              <TabsTrigger value="mine">{t("tabMine")}</TabsTrigger>
              <TabsTrigger value="all">{t("tabAll")}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

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
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("anyStatus")}</SelectItem>
            <SelectItem value="open">{t("statusOpen")}</SelectItem>
            <SelectItem value="closed">{t("statusClosed")}</SelectItem>
          </SelectContent>
        </Select>

        {activeCategories.length > 0 && (
          <Select
            value={categoryId || "any"}
            items={Object.fromEntries([
              ["any", t("anyCategory")],
              ...activeCategories.map((c) => [c.id, c.name]),
            ])}
            onValueChange={(v) =>
              setParams({ category: v === "any" ? null : (v as string), page: null })
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("anyCategory")}</SelectItem>
              {activeCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ms-auto">
          <Link href="/tickets/new">
            <Button className="gap-2">
              <Plus className="size-4" />
              {t("newTicket")}
            </Button>
          </Link>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
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
                  ticket.status === "closed" && "opacity-70"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {ticket.subject}
                    </span>
                    <TicketStatusBadge status={ticket.status} />
                  </div>
                  <span className="truncate text-sm text-muted-foreground">
                    {ticket.category}
                    {ticket.subcategory && ` · ${ticket.subcategory}`}
                    {scope === "all" && user?.id !== ticket.author.id && (
                      <>
                        {" · "}
                        <UserRound className="inline size-3.5 -translate-y-px" />{" "}
                        {ticket.author.name}
                      </>
                    )}
                  </span>
                </div>
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
