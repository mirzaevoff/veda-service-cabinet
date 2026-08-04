"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { UsersTable } from "@/components/admin/users/users-table";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { NoAccess } from "@/components/admin/no-access";

export default function AdminUsersPage() {
  const t = useTranslations("AdminUsers");
  const { can } = useCurrentUser();

  if (!can(PERMISSIONS.usersList)) return <NoAccess />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />
      <UsersTable />
    </div>
  );
}
