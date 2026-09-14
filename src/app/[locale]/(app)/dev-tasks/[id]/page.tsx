"use client";

import { use } from "react";
import { DevTaskView } from "@/components/dev-tasks/dev-task-view";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function DevTaskRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.devTasksView)) return <NoAccess />;
  return <DevTaskView id={id} />;
}
