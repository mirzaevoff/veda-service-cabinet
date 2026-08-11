"use client";

import { RolesList } from "@/components/admin/roles/roles-list";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

/** Роли и Доступы: отдельная страница с широким контейнером */
export default function AdminRolesPage() {
  const { can, loading } = useCurrentUser();

  if (!loading && !can(PERMISSIONS.rolesRead)) return <NoAccess />;

  return <RolesList />;
}
