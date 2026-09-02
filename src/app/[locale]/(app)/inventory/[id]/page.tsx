"use client";

import { use } from "react";
import { InventoryAuditPage } from "@/components/inventory/inventory-audit";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function InventoryAuditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.inventoryView)) return <NoAccess />;
  return <InventoryAuditPage auditId={id} />;
}
