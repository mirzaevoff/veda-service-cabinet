"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketsList } from "@/components/tickets/tickets-list";
import { TechDashboard } from "@/components/tickets/tech-dashboard";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Хаб «Обращения»: Заявки · Статистика (для staff) */
export default function TicketsPage() {
  const t = useTranslations("Tickets");
  const { can } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = [
    { key: "queue", visible: true },
    { key: "stats", visible: can(PERMISSIONS.ticketsList) },
  ].filter((tab) => tab.visible);

  const requested = searchParams.get("tab") ?? "";
  const active = tabs.some((tab) => tab.key === requested) ? requested : "queue";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("list.title")} description={t("list.description")} />
      <Tabs
        value={active}
        onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
        className="flex flex-col gap-5"
      >
        {tabs.length > 1 && (
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {t(`tabs.${tab.key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <TabsContent value="queue">
          <Suspense>
            <TicketsList />
          </Suspense>
        </TabsContent>
        {tabs.some((tab) => tab.key === "stats") && (
          <TabsContent value="stats">
            <TechDashboard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
