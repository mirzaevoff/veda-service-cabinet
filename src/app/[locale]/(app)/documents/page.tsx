"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { DocumentsFeed } from "@/components/documents/documents-feed";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function DocumentsPage() {
  const t = useTranslations("Documents");
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.documentsView)) return <NoAccess />;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <DocumentsFeed />
    </div>
  );
}
