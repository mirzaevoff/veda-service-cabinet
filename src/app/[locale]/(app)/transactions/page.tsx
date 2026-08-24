"use client";

import { LedgerFeed } from "@/components/balances/ledger-feed";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function TransactionsPage() {
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.balancesView)) return <NoAccess />;
  return <LedgerFeed />;
}
