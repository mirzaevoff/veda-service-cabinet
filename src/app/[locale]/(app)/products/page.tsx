"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { ProductsTable } from "@/components/products/products-table";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsPage() {
  const t = useTranslations("Products");
  const { user, loading, can } = useCurrentUser();

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-5xl">
        <Skeleton className="mb-6 h-10 w-56 rounded-lg" />
      </div>
    );
  }

  if (!can(PERMISSIONS.productsList)) return <NoAccess />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />
      <ProductsTable />
    </div>
  );
}
