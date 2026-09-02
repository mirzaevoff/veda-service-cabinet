"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { EquipmentTable } from "@/components/equipment/equipment-table";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function EquipmentPage() {
  const t = useTranslations("Equipment");
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.equipmentView)) return <NoAccess />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />
      <EquipmentTable />
    </div>
  );
}
