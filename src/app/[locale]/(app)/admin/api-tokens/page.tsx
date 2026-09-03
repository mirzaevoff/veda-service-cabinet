"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { ApiTokensManager } from "@/components/admin/api-tokens/api-tokens-manager";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { NoAccess } from "@/components/admin/no-access";

export default function ApiTokensPage() {
  const t = useTranslations("ApiTokens");
  const { can, loading } = useCurrentUser();

  if (!loading && !can(PERMISSIONS.apiTokensManage)) return <NoAccess />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <ApiTokensManager />
    </div>
  );
}
