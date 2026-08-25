"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { InvoicesList } from "@/components/invoices/invoices-list";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function InvoicesPage() {
  const t = useTranslations("Invoices");
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.invoicesView)) return <NoAccess />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <InvoicesList />
    </div>
  );
}
