"use client";

import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { useRouter } from "@/i18n/navigation";

const ADMIN_PERMISSIONS = [
  PERMISSIONS.usersList,
  PERMISSIONS.rolesRead,
  PERMISSIONS.ticketsCategoriesManage,
  PERMISSIONS.notificationsSend,
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, can } = useCurrentUser();
  const router = useRouter();
  const allowed = ADMIN_PERMISSIONS.some((p) => can(p));

  useEffect(() => {
    if (!loading && user && !allowed) router.replace("/tickets");
  }, [loading, user, allowed, router]);

  if (loading || !user) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (!allowed) return null;

  return children;
}
