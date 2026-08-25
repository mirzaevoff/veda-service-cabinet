"use client";

import { use } from "react";
import { InvoicePage } from "@/components/invoices/invoice-page";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.invoicesView)) return <NoAccess />;
  return <InvoicePage invoiceId={id} />;
}
