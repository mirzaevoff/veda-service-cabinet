"use client";

import { VenuesList } from "@/components/venues/venues-list";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

/** Заведения клиентов: зеркало Customers портала iiko */
export default function VenuesPage() {
  const { can, loading } = useCurrentUser();

  if (!loading && !can(PERMISSIONS.venuesView)) return <NoAccess />;

  return <VenuesList />;
}
