"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { ActivityLogsTable } from "@/components/admin/logs/activity-logs-table";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { NoAccess } from "@/components/admin/no-access";

export default function AdminLogsPage() {
  const t = useTranslations("AdminLogs");
  const { can } = useCurrentUser();

  if (!can(PERMISSIONS.logsView)) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} description={t("description")} />
      <ActivityLogsTable />
    </div>
  );
}
