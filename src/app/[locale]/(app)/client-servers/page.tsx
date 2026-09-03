"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { IikoServers } from "@/components/iiko-partner/iiko-servers";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { NoAccess } from "@/components/admin/no-access";

/** Серверы клиентов из iiko Partner — отдельный раздел Тех. поддержки */
export default function ClientServersPage() {
  const t = useTranslations("ClientServers");
  const { can, loading } = useCurrentUser();

  if (loading) return null;
  if (!can(PERMISSIONS.iikoServersView)) return <NoAccess />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />
      <IikoServers />
    </div>
  );
}
