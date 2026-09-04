"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpRight,
  Building2,
  ClipboardList,
  Landmark,
  ListChecks,
  Package,
  ReceiptText,
  Rocket,
  Server,
  Store,
  Ticket,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BankRatesWidget } from "@/components/bank/bank-rates-widget";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { Dashboard } from "@/lib/api";
import { dashboardApi } from "@/lib/api-authed";
import { formatMinor, formatTiyin } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Сетка дашборда: адаптивно 1 → 2 → 3 → 4 колонки, во всю ширину */
const DASH_GRID = "grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

/** Строка «метка — значение» внутри карточки дашборда */
function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "destructive" | "warning";
}) {
  const positive = typeof value !== "number" || value > 0;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "destructive" && positive && "text-destructive",
          tone === "warning" && positive && "text-warning"
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
  headline: React.ReactNode;
  headlineLabel: string;
  children?: React.ReactNode;
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
  const locale = useLocale();
  const { can } = useCurrentUser();
  const canRates = can(PERMISSIONS.bankView);

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
      <div className={DASH_GRID}>
        {canRates && (
          <div className="sm:col-span-2">
            <BankRatesWidget />
          </div>
        )}
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-lg animate-in fade-in duration-300" />
        ))}
      </div>
    );
  }

  const {
    servers,
    venues,
    tickets,
    users,
    balances,
    bank,
    invoicesCustomer,
    invoicesPartner,
    checklists,
    inventory,
    equipment,
    legalEntities,
  } = data;
  const hasAny =
    servers || venues || tickets || users || balances || bank ||
    invoicesCustomer || invoicesPartner || checklists || inventory ||
    equipment || legalEntities;
  if (!hasAny && !canRates) return <InDevelopment />;

  return (
    <div className={DASH_GRID}>
      {canRates && (
        <div className="sm:col-span-2">
          <BankRatesWidget />
        </div>
      )}
      {servers && (
        <BlockCard
          icon={Server}
          title={t("servers")}
          href="/client-servers"
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
          {servers.versions.outdated > 0 && (
            <StatRow
              label={t("serversOutdated")}
              value={servers.versions.outdated}
              tone="warning"
            />
          )}
          {servers.versions.critical > 0 && (
            <StatRow
              label={t("serversCritical")}
              value={servers.versions.critical}
              tone="destructive"
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

      {balances && (
        <BlockCard
          icon={Wallet}
          title={t("balances")}
          href="/legal-entities"
          headline={formatTiyin(balances.totalTiyin, locale)}
          headlineLabel={t("balancesTotal")}
          delay={240}
        >
          <StatRow label={t("balancesDebtors")} value={balances.debtors} tone="destructive" />
          {balances.debtors > 0 && (
            <StatRow
              label={t("balancesDebt")}
              value={formatTiyin(balances.debtTiyin, locale)}
              tone="destructive"
            />
          )}
        </BlockCard>
      )}

      {bank && (
        <BlockCard
          icon={Landmark}
          title={t("bank")}
          href="/finance?tab=bank"
          headline={bank.unrecognized}
          headlineLabel={t("bankUnrecognized")}
          delay={300}
        >
          <StatRow
            label={t("bankIncomingToday")}
            value={formatTiyin(bank.incomingTodayTiyin, locale)}
            tone="success"
          />
          <StatRow label={t("bankIncomingCount")} value={bank.incomingTodayCount} />
        </BlockCard>
      )}

      {invoicesCustomer && (
        <BlockCard
          icon={ReceiptText}
          title={t("invoicesCustomer")}
          href="/finance?tab=invoices"
          headline={formatMinor(invoicesCustomer.amountMinor, invoicesCustomer.currency, locale)}
          headlineLabel={t("invoicesUnpaid")}
          delay={360}
        >
          <StatRow label={t("invoicesCount")} value={invoicesCustomer.count} />
        </BlockCard>
      )}

      {invoicesPartner && (
        <BlockCard
          icon={ReceiptText}
          title={t("invoicesPartner")}
          href="/iiko-partner"
          headline={formatMinor(invoicesPartner.amountMinor, invoicesPartner.currency, locale)}
          headlineLabel={t("invoicesUnpaid")}
          delay={420}
        >
          <StatRow label={t("invoicesCount")} value={invoicesPartner.count} />
        </BlockCard>
      )}

      {checklists && (
        <BlockCard
          icon={ListChecks}
          title={t("checklists")}
          href="/checklists"
          headline={checklists.dueToday}
          headlineLabel={t("checklistsDue")}
          delay={480}
        >
          <StatRow label={t("checklistsCompleted")} value={checklists.completed} tone="success" />
          <StatRow label={t("checklistsOverdue")} value={checklists.overdue} tone="destructive" />
        </BlockCard>
      )}

      {inventory && (
        <BlockCard
          icon={ClipboardList}
          title={t("inventory")}
          href="/equipment?tab=inventory"
          headline={inventory.open}
          headlineLabel={t("inventoryOpen")}
          delay={540}
        >
          <StatRow
            label={t("inventoryDiscrepancies")}
            value={inventory.discrepancies}
            tone="destructive"
          />
        </BlockCard>
      )}

      {equipment && (
        <BlockCard
          icon={Package}
          title={t("equipment")}
          href="/equipment"
          headline={equipment.total}
          headlineLabel={t("equipmentTotal")}
          delay={600}
        />
      )}

      {legalEntities && (
        <BlockCard
          icon={Building2}
          title={t("legalEntities")}
          href="/legal-entities"
          headline={legalEntities.total}
          headlineLabel={t("legalEntitiesTotal")}
          delay={660}
        >
          <StatRow label={t("legalEntitiesWithAccess")} value={legalEntities.withAccess} />
        </BlockCard>
      )}
    </div>
  );
}
