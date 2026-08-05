"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { EntitiesTable } from "@/components/legal-entities/entities-table";
import { IncomingRequests } from "@/components/legal-entities/incoming-requests";
import { MyEntities } from "@/components/legal-entities/my-entities";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";

export default function LegalEntitiesPage() {
  const t = useTranslations("LegalEntities");
  const { user, loading, can } = useCurrentUser();
  const isStaff = can(PERMISSIONS.legalEntitiesList);
  // Ремоунт таблицы после решений по запросам (approve может создать ЮЛ)
  const [tableKey, setTableKey] = useState(0);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-4xl">
        <Skeleton className="mb-6 h-10 w-56 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("title")}
        description={isStaff ? t("descriptionStaff") : t("descriptionMy")}
      />
      {isStaff ? (
        <div className="flex flex-col gap-8">
          <IncomingRequests
            staff={can(PERMISSIONS.legalEntitiesManage)}
            onDecided={() => setTableKey((k) => k + 1)}
          />
          <EntitiesTable key={tableKey} />
        </div>
      ) : (
        <MyEntities />
      )}
    </div>
  );
}
