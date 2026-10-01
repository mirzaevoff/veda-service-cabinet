"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { PostsList } from "@/components/posts/posts-list";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

/** Посты сайта vedavector.com */
export default function PostsPage() {
  const t = useTranslations("Posts");
  const { can, loading } = useCurrentUser();

  if (loading) return null;
  if (!can(PERMISSIONS.postsManage)) return <NoAccess />;

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <PostsList />
    </div>
  );
}
