"use client";

import { RolesList } from "@/components/admin/roles/roles-list";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function AdminRolesPage() {
  const { can } = useCurrentUser();

  if (!can(PERMISSIONS.rolesRead)) return <NoAccess />;

  return <RolesList />;
}
