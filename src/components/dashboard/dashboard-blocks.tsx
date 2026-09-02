"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight,
  Rocket,
  Server,
  Store,
  Ticket,
  UsersRound,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dashboard } from "@/lib/api";
import { dashboardApi } from "@/lib/api-authed";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Строка «метка — значение» внутри карточки дашборда */
function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "destructive" | "warning";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "destructive" && value > 0 && "text-destructive",
          tone === "warning" && value > 0 && "text-warning"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Карточка блока: иконка, заголовок, крупное число, строки, ссылка в раздел */
function BlockCard({
  icon: Icon,
  title,
  href,
  headline,
  headlineLabel,
  children,
  delay,
}: {
  icon: typeof Server;
  title: string;
  href: string;
  headline: number;
  headlineLabel: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-lg border border-border p-5 transition-colors duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards] hover:border-primary/40"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-light">
          <Icon className="size-4 text-primary" strokeWidth={1.75} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <ArrowUpRight className="ms-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{headline}</span>
        <span className="text-sm text-muted-foreground">{headlineLabel}</span>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </Link>
  );
}

/** Заглушка для пользователей, которым пока нечего показать */
function InDevelopment() {
  const t = useTranslations("Dashboard");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="duration-450 animate-in fade-in zoom-in-90">
        <div className="flex size-14 animate-pulse items-center justify-center rounded-lg bg-accent-light [animation-duration:2.5s]">
          <Rocket className="size-[26px] text-primary" strokeWidth={1.75} />
        </div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight duration-450 animate-in fade-in slide-in-from-bottom-4">
        {t("inDevelopment")}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground duration-450 animate-in fade-in slide-in-from-bottom-4 [animation-delay:120ms] [animation-fill-mode:backwards]">
        {t("comingSoon")}
      </p>
    </div>
  );
}

/** Блоки дашборда из GET /dashboard — каждый виден только при своём праве */
export function DashboardBlocks() {
  const t = useTranslations("Dashboard.blocks");

  const [data, setData] = useState<Dashboard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    dashboardApi
      .get()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <InDevelopment />;

  if (!data) {
    return (
      <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-lg animate-in fade-in duration-300" />
        ))}
      </div>
    );
  }

  const { servers, venues, tickets, users } = data;
  if (!servers && !venues && !tickets && !users) return <InDevelopment />;

  return (
    <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2">
      {servers && (
        <BlockCard
          icon={Server}
          title={t("servers")}
          href="/iiko-partner?tab=servers"
          headline={servers.total}
          headlineLabel={t("serversTotal")}
          delay={0}
        >
          <StatRow label={t("serversUp")} value={servers.up} tone="success" />
          <StatRow label={t("serversDown")} value={servers.down} tone="destructive" />
          {servers.maintenance > 0 && (
            <StatRow
              label={t("serversMaintenance")}
              value={servers.maintenance}
              tone="warning"
            />
          )}
        </BlockCard>
      )}

      {venues && (
        <BlockCard
          icon={Store}
          title={t("venues")}
          href="/venues"
          headline={venues.total}
          headlineLabel={t("venuesTotal", { rms: venues.rms, chains: venues.chains })}
          delay={60}
        >
          <StatRow label={t("venuesOpen")} value={venues.open} tone="success" />
          <StatRow label={t("venuesClosed")} value={venues.closed} />
          {venues.temporarilyClosed > 0 && (
            <StatRow
              label={t("venuesTempClosed")}
              value={venues.temporarilyClosed}
              tone="warning"
            />
          )}
          {venues.unknown > 0 && (
            <StatRow label={t("venuesUnknown")} value={venues.unknown} />
          )}
          <StatRow label={t("venuesLinked")} value={venues.linked} />
        </BlockCard>
      )}

      {tickets && (
        <BlockCard
          icon={Ticket}
          title={t("tickets")}
          href="/tickets"
          headline={tickets.open}
          headlineLabel={t("ticketsOpen")}
          delay={120}
        >
          <StatRow
            label={t("ticketsUnclaimed")}
            value={tickets.unclaimed}
            tone="warning"
          />
          <StatRow
            label={t("ticketsBreached")}
            value={tickets.breached}
            tone="destructive"
          />
          <StatRow label={t("ticketsClosed")} value={tickets.closed} />
        </BlockCard>
      )}

      {users && (
        <BlockCard
          icon={UsersRound}
          title={t("users")}
          href="/admin/users"
          headline={users.online}
          headlineLabel={t("usersOnline")}
          delay={180}
        >
          <StatRow label={t("usersTotal")} value={users.total} />
        </BlockCard>
      )}
    </div>
  );
}
