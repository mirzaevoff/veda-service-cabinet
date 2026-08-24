"use client";

import { use } from "react";
import { InvoicePage } from "@/components/iiko-partner/invoice-page";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function IikoInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { can, loading } = useCurrentUser();
  const canView =
    can(PERMISSIONS.iikoInvoicesView) ||
    can(PERMISSIONS.iikoPartnerInvoicesView);
  if (!loading && !canView) return <NoAccess />;
  return <InvoicePage invoiceId={id} />;
}
