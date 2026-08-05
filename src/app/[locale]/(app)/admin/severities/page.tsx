"use client";

import { SeveritiesManager } from "@/components/admin/severities/severities-manager";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function AdminSeveritiesPage() {
  const { can } = useCurrentUser();

  if (!can(PERMISSIONS.ticketsCategoriesManage)) return <NoAccess />;

  return <SeveritiesManager />;
}
