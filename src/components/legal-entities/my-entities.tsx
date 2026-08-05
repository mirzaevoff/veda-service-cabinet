"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, KeyRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessRequestForm } from "./access-request-form";
import { AccessRequestsHistory } from "./access-requests-history";
import { IncomingRequests } from "./incoming-requests";
import { MembersManager } from "./members-manager";
import { EntityRequisites } from "./entity-requisites";
import type { AccessRequest, LegalEntity } from "@/lib/api";
import {
  accessRequestsApi,
  legalEntitiesApi,
  SessionExpiredError,
} from "@/lib/api-authed";
import { useDelayed } from "@/hooks/use-delayed";
import { getCached, setCached } from "@/lib/list-cache";
import { useRouter } from "@/i18n/navigation";

/** Карточка организации; для owner'а — с управлением участниками */
function MyEntityCard({
  entity,
  index,
  onChanged,
}: {
  entity: LegalEntity;
  index: number;
  onChanged: () => void;
}) {
  const t = useTranslations("LegalEntities");
  // Детали: members присутствуют в ответе только у owner'а (и staff)
  const [details, setDetails] = useState<LegalEntity | null>(null);
  const [showMembers, setShowMembers] = useState(false);

  const reloadDetails = useCallback(() => {
    legalEntitiesApi
      .get(entity.id)
      .then(setDetails)
      .catch(() => {});
  }, [entity.id]);

  useEffect(reloadDetails, [reloadDetails]);

  const isOwner = !!details?.members;

  return (
    <Card
      className="gap-4 rounded-lg p-5 duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
      style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light">
          <Building2 className="size-5 text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate font-semibold">{entity.name}</h3>
          {entity.establishment && (
            <span className="truncate text-sm text-muted-foreground">
              {entity.establishment}
            </span>
          )}
        </div>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMembers((v) => !v)}
            className="gap-2"
          >
            <Users className="size-4" />
            {t("members.manage")}
          </Button>
        )}
      </div>
      <EntityRequisites entity={entity} />
      {isOwner && showMembers && details && (
        <>
          <Separator />
          <MembersManager
            entityId={entity.id}
            members={details.members ?? []}
            onChanged={() => {
              reloadDetails();
              onChanged();
            }}
          />
        </>
      )}
    </Card>
  );
}

export function MyEntities() {
  const ta = useTranslations("LegalEntities.access");
  const router = useRouter();

  const [entities, setEntities] = useState<LegalEntity[] | null>(
    () => getCached<LegalEntity[]>("my-legal-entities") ?? null
  );
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const showSkeleton = useDelayed(!entities);

  const reloadEntities = useCallback(() => {
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
  }, [router]);

  const reloadRequests = useCallback(() => {
    accessRequestsApi
      .my({ limit: 50 })
      .then((page) => setRequests(page.items))
      .catch(() => setRequests([]));
  }, []);

  useEffect(() => {
    reloadEntities();
    reloadRequests();
  }, [reloadEntities, reloadRequests]);

  const reloadAll = useCallback(() => {
    reloadEntities();
    reloadRequests();
  }, [reloadEntities, reloadRequests]);

  if (!entities || !requests) {
    return (
      <div className="flex flex-col gap-3">
        {showSkeleton &&
          Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg animate-in fade-in duration-300" />
          ))}
      </div>
    );
  }

  const noOrgs = entities.length === 0;

  return (
    <div className="flex flex-col gap-8">
      {noOrgs ? (
        /* Экран «Запросите доступ» — после регистрации, организаций нет */
        <div className="flex flex-col gap-6 duration-450 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col items-center gap-4 pt-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
              <KeyRound className="size-[26px] text-primary" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">{ta("heroTitle")}</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                {ta("heroHint")}
              </p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-md">
            <AccessRequestForm onCreated={reloadRequests} />
          </div>
          <div className="mx-auto w-full max-w-md">
            <AccessRequestsHistory requests={requests} onChanged={reloadAll} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {entities.map((entity, i) => (
              <MyEntityCard
                key={entity.id}
                entity={entity}
                index={i}
                onChanged={reloadAll}
              />
            ))}
          </div>

          <IncomingRequests staff={false} onDecided={reloadAll} />

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold">{ta("moreTitle")}</h3>
              <p className="text-sm text-muted-foreground">{ta("moreHint")}</p>
            </div>
            <div className="max-w-md">
              <AccessRequestForm onCreated={reloadRequests} />
            </div>
            <AccessRequestsHistory requests={requests} onChanged={reloadAll} />
          </section>
        </>
      )}
    </div>
  );
}
