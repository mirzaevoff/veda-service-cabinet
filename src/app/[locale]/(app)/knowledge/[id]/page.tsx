"use client";

import { use } from "react";
import { ArticleView } from "@/components/knowledge/article-view";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function ArticleRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.knowledgeView)) return <NoAccess />;
  return <ArticleView articleId={id} />;
}
