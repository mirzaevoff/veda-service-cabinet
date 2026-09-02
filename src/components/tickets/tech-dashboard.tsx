"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/components/common/date-picker";
import type {
  AgentSortField,
  AgentsStats,
  OverviewStats,
} from "@/lib/api";
import { ticketsApi, SessionExpiredError } from "@/lib/api-authed";
import { formatMinutes } from "@/lib/format";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Period = "day" | "week" | "month" | "custom";

export function TechDashboard() {
  const t = useTranslations("TechDashboard");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [period, setPeriod] = useState<Period>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortField, setSortField] = useState<AgentSortField>("closed");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [agents, setAgents] = useState<AgentsStats | null>(null);
  const [loading, setLoading] = useState(true);

  const statsParams = useCallback(() => {
    if (period === "custom") {
      return {
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      };
    }
    return { preset: period };
  }, [period, from, to]);

  const load = useCallback(async () => {
    if (period === "custom" && (!from || !to)) return;
    setLoading(true);
    try {
      const p = statsParams();
      const [ov, ag] = await Promise.all([
        ticketsApi.statsOverview(p),
        ticketsApi.statsAgents({ ...p, sort: sortField, order }),
      ]);
      setOverview(ov);
      setAgents(ag);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsParams, sortField, order, period, from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Диапазон для ссылок-детализаций (из ответа overview)
  const range = overview ? { from: overview.from, to: overview.to } : { from: null, to: null };
  const ticketsHref = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ scope: "all", ...extra });
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    return `/tickets?${p.toString()}`;
  };

  function toggleSort(field: AgentSortField) {
    if (sortField === field) setOrder((o) => (o === "desc" ? "asc" : "desc"));
    else {
      setSortField(field);
      setOrder("desc");
    }
  }

  const overviewCards: [string, string][] = overview
    ? [
        [t("m.total"), String(overview.total)],
        [t("m.new"), String(overview.new)],
        [t("m.inWork"), String(overview.inWork)],
        [t("m.closed"), String(overview.closed)],
        [t("m.avgFirstResponse"), formatMinutes(overview.avgFirstResponseMinutes)],
        [t("m.avgHandling"), formatMinutes(overview.avgHandlingMinutes)],
        [t("m.slaBreaches"), String(overview.slaBreaches)],
        [
          t("m.slaCompliance"),
          overview.slaCompliancePct === null ? "—" : `${overview.slaCompliancePct}%`,
        ],
      ]
    : [];

  const periods: Period[] = ["day", "week", "month", "custom"];

  return (
    <div className="flex flex-col gap-5">
      {/* Период */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                period === p ? "bg-accent-light text-primary" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {t(`period.${p}`)}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <DatePicker value={from} onChange={setFrom} placeholder={t("from")} />
            <span className="text-muted-foreground">—</span>
            <DatePicker value={to} onChange={setTo} placeholder={t("to")} />
          </div>
        )}
      </div>

      {/* Сводка */}
      {loading && !overview ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {overviewCards.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 rounded-lg border border-border p-4">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
              <span className="text-2xl font-bold tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Сравнение сотрудников */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("agentsTitle")}</h3>
        {loading && !agents ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : !agents || agents.agents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noAgents")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("a.agent")}</TableHead>
                  <SortTh field="accepted" label={t("a.accepted")} {...{ sortField, order, toggleSort }} />
                  <SortTh field="closed" label={t("a.closed")} {...{ sortField, order, toggleSort }} />
                  <SortTh field="active" label={t("a.active")} {...{ sortField, order, toggleSort }} />
                  <SortTh field="firstResponseMinutes" label={t("a.firstResponse")} {...{ sortField, order, toggleSort }} />
                  <SortTh field="handlingMinutes" label={t("a.handling")} {...{ sortField, order, toggleSort }} />
                  <SortTh field="totalHandlingMinutes" label={t("a.totalHandling")} {...{ sortField, order, toggleSort }} />
                  <SortTh field="slaBreaches" label={t("a.slaBreaches")} {...{ sortField, order, toggleSort }} />
                  <SortTh field="slaCompliancePct" label={t("a.slaPct")} {...{ sortField, order, toggleSort }} />
                  <SortTh field="avgRating" label={t("a.rating")} {...{ sortField, order, toggleSort }} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.agents.map((a) => (
                  <TableRow key={a.agentId}>
                    <TableCell className="font-medium whitespace-nowrap">{a.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.accepted}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Link href={ticketsHref({ closedById: a.agentId })} className="text-primary hover:underline">
                        {a.closed}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{a.active}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatMinutes(a.firstResponseMinutes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatMinutes(a.handlingMinutes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatMinutes(a.totalHandlingMinutes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.slaBreaches > 0 ? (
                        <Link
                          href={ticketsHref({ closedById: a.agentId, breached: "1" })}
                          className="font-medium text-primary hover:underline"
                        >
                          {a.slaBreaches}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.slaCompliancePct === null ? "—" : `${a.slaCompliancePct}%`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.avgRating === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5">
                          {a.avgRating.toFixed(1)}
                          <Star className="size-3 fill-warning text-warning" />
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function SortTh({
  field,
  label,
  sortField,
  order,
  toggleSort,
}: {
  field: AgentSortField;
  label: string;
  sortField: AgentSortField;
  order: "asc" | "desc";
  toggleSort: (f: AgentSortField) => void;
}) {
  const active = sortField === field;
  return (
    <TableHead className="text-right">
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active ? "text-foreground" : ""
        )}
      >
        {label}
        {active &&
          (order === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </TableHead>
  );
}
