"use client";

import { use } from "react";
import { DocumentView } from "@/components/documents/document-view";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";

export default function DocumentRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can, loading } = useCurrentUser();
  if (!loading && !can(PERMISSIONS.documentsView)) return <NoAccess />;
  return <DocumentView id={id} />;
}
