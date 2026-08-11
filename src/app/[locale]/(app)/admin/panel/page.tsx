"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BroadcastForm } from "@/components/admin/notifications/broadcast-form";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Панель управления: операционные инструменты админа */
export default function AdminPanelPage() {
  const t = useTranslations("AdminPanel");
  const { can } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = [
    { key: "settings", visible: can(PERMISSIONS.settingsManage) },
    { key: "broadcast", visible: can(PERMISSIONS.notificationsSend) },
  ].filter((tab) => tab.visible);

  if (tabs.length === 0) return <NoAccess />;

  const requested = searchParams.get("tab") ?? "";
  const active = tabs.some((tab) => tab.key === requested)
    ? requested
    : tabs[0].key;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs
        value={active}
        onValueChange={(v) =>
          router.replace(`${pathname}?tab=${v}`, { scroll: false })
        }
        className="flex flex-col gap-5"
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {t(`tabs.${tab.key}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="broadcast">
          <BroadcastForm />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
