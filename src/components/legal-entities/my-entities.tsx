"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityRequisites } from "./entity-requisites";
import type { LegalEntity } from "@/lib/api";
import { legalEntitiesApi, SessionExpiredError } from "@/lib/api-authed";
import { useDelayed } from "@/hooks/use-delayed";
import { getCached, setCached } from "@/lib/list-cache";
import { useRouter } from "@/i18n/navigation";

export function MyEntities() {
  const t = useTranslations("LegalEntities");
  const router = useRouter();
  const [entities, setEntities] = useState<LegalEntity[] | null>(
    () => getCached<LegalEntity[]>("my-legal-entities") ?? null
  );
  const showSkeleton = useDelayed(!entities);

  useEffect(() => {
    legalEntitiesApi
      .my()
      .then((items) => {
        setEntities(items);
        setCached("my-legal-entities", items);
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else setEntities([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!entities) {
    return (
      <div className="flex flex-col gap-3">
        {showSkeleton &&
          Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg animate-in fade-in duration-300" />
          ))}
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
        <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
          <Building2 className="size-[26px] text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t("myEmptyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("myEmptyHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entities.map((entity, i) => (
        <Card
          key={entity.id}
          className="gap-4 rounded-lg p-5 duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
          style={{ animationDelay: `${Math.min(i * 60, 300)}ms` }}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light">
              <Building2 className="size-5 text-primary" strokeWidth={1.75} />
            </div>
            <h3 className="min-w-0 flex-1 truncate font-semibold">
              {entity.name}
            </h3>
          </div>
          <EntityRequisites entity={entity} />
        </Card>
      ))}
    </div>
  );
}
