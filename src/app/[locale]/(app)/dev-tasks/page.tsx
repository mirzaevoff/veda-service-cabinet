"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { DevTasksBoard } from "@/components/dev-tasks/dev-tasks-board";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function DevTasksPage() {
  const t = useTranslations("DevTasks");
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.devTasksView)) return <NoAccess />;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t("title")} description={t("description")} />
      <DevTasksBoard />
    </div>
  );
}
