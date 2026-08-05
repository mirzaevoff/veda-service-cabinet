"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BroadcastForm } from "@/components/admin/notifications/broadcast-form";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

/** Панель управления: операционные инструменты админа */
export default function AdminPanelPage() {
  const t = useTranslations("AdminPanel");
  const { can } = useCurrentUser();

  if (!can(PERMISSIONS.notificationsSend)) return <NoAccess />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs defaultValue="broadcast" className="flex flex-col gap-5">
        <TabsList>
          <TabsTrigger value="broadcast">{t("tabs.broadcast")}</TabsTrigger>
        </TabsList>
        <TabsContent value="broadcast">
          <BroadcastForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
