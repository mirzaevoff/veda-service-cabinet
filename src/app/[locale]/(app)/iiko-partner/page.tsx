"use client";

import { PartnerProfile } from "@/components/iiko-partner/partner-profile";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

/** iiko Partner: профиль компании на партнёрском портале */
export default function IikoPartnerPage() {
  const { can, loading } = useCurrentUser();

  if (!loading && !can(PERMISSIONS.iikoPartnerView)) return <NoAccess />;

  return <PartnerProfile />;
}
