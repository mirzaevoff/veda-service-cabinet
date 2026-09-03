"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BroadcastForm } from "@/components/admin/notifications/broadcast-form";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { ActivityLogsTable } from "@/components/admin/logs/activity-logs-table";
import { ApiTokensManager } from "@/components/admin/api-tokens/api-tokens-manager";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Хаб «Система»: Настройки · Рассылка · Журнал · API-токены */
export default function AdminSystemPage() {
  const t = useTranslations("AdminSystem");
  const { can } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = [
    { key: "settings", visible: can(PERMISSIONS.settingsManage) },
    { key: "broadcast", visible: can(PERMISSIONS.notificationsSend) },
    { key: "logs", visible: can(PERMISSIONS.logsView) },
    { key: "apiTokens", visible: can(PERMISSIONS.apiTokensManage) },
  ].filter((tab) => tab.visible);

  if (tabs.length === 0) return <NoAccess />;

  const requested = searchParams.get("tab") ?? "";
  const active = tabs.some((tab) => tab.key === requested) ? requested : tabs[0].key;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs
        value={active}
        onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
        className="flex flex-col gap-5"
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {t(`tabs.${tab.key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="settings">
          <div className="max-w-3xl">
            <SettingsForm />
          </div>
        </TabsContent>
        <TabsContent value="broadcast">
          <div className="max-w-3xl">
            <BroadcastForm />
          </div>
        </TabsContent>
        <TabsContent value="logs">
          <ActivityLogsTable />
        </TabsContent>
        <TabsContent value="apiTokens">
          <ApiTokensManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
