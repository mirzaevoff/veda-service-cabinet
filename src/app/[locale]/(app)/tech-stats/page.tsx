"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { TechDashboard } from "@/components/tickets/tech-dashboard";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function TechStatsPage() {
  const t = useTranslations("TechDashboard");
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.ticketsList)) return <NoAccess />;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />
      <TechDashboard />
    </div>
  );
}
