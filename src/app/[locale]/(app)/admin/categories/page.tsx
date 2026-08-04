"use client";

import { CategoryTree } from "@/components/admin/categories/category-tree";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function AdminCategoriesPage() {
  const { can } = useCurrentUser();

  if (!can(PERMISSIONS.ticketsCategoriesManage)) return <NoAccess />;

  return <CategoryTree />;
}
