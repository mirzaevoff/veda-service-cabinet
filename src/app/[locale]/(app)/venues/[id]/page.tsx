"use client";

import { use } from "react";
import { VenuePage } from "@/components/venues/venue-page";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function VenueSinglePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.venuesView)) return <NoAccess />;
  return <VenuePage venueId={id} />;
}
