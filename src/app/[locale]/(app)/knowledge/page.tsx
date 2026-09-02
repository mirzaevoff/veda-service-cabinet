"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { KnowledgeList } from "@/components/knowledge/knowledge-list";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function KnowledgePage() {
  const t = useTranslations("Knowledge");
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.knowledgeView)) return <NoAccess />;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <KnowledgeList />
    </div>
  );
}
