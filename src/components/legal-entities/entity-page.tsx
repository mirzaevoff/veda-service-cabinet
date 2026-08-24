"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Landmark,
  MapPin,
  Network,
  Pencil,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { EntityFormDialog } from "./entity-form-dialog";
import { MembersManager } from "./members-manager";
import { directorName } from "./entity-requisites";
import type { LegalEntity, Venue, VenueStatus } from "@/lib/api";
import { legalEntitiesApi, venuesApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const VENUE_STATUS_STYLES: Record<VenueStatus, string> = {
  open: "bg-success-light text-success",
  closed: "bg-secondary text-muted-foreground",
  temporarily_closed: "bg-warning-light text-warning",
};

/** Заведения, привязанные к этому ЮЛ (видно при праве venues.view) */
function EntityVenues({ entityId }: { entityId: string }) {
  const t = useTranslations("LegalEntities.venues");
  const tv = useTranslations("Venues");
  const [venues, setVenues] = useState<Venue[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    venuesApi
      .list({ legalEntityId: entityId, limit: 100 })
      .then((page) => {
        if (!cancelled) setVenues(page.items);
      })
      .catch(() => {
        if (!cancelled) setVenues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
            <Store className="size-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("title")}
          </h4>
          {venues && venues.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {venues.length}
            </span>
          )}
        </div>
        <Link
          href="/venues"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("allVenues")}
        </Link>
      </div>

      {!venues ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : venues.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-8 text-center duration-300 animate-in fade-in">
          <div className="flex size-12 items-center justify-center rounded-lg bg-accent-light">
            <Store className="size-6 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("emptyTitle")}</span>
            <span className="text-xs text-muted-foreground">{t("emptyHint")}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{venue.name}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 gap-1",
                      venue.kind === "chain" && "bg-accent-light text-primary"
                    )}
                  >
                    {venue.kind === "chain" ? (
                      <Network className="size-3" />
                    ) : (
                      <Store className="size-3" />
                    )}
                    {tv(`kind.${venue.kind}`)}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {venue.uid}
                  {venue.city && ` · ${venue.city}`}
                </span>
              </div>
              {venue.kind === "rms" && (
                <Badge
                  variant="secondary"
                  className={cn("shrink-0", VENUE_STATUS_STYLES[venue.status])}
                >
                  {tv(`status.${venue.status}`)}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Страница юрлица: карточки с реквизитами и участниками */
export function EntityPage({ entityId }: { entityId: string }) {
  const t = useTranslations("LegalEntities");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.legalEntitiesManage);

  const [entity, setEntity] = useState<LegalEntity | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    legalEntitiesApi
      .get(entityId)
      .then(setEntity)
      .catch(() => {
        toast.error(t("errors.generic"));
        router.replace("/legal-entities");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/router нестабильны
  }, [entityId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function remove() {
    if (!entity) return;
    setBusy(true);
    try {
      await legalEntitiesApi.remove(entity.id);
      toast.success(t("deleted"));
      router.replace("/legal-entities");
    } catch {
      toast.error(t("errors.generic"));
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const formatDate = (iso: string, dateOnly = false) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(dateOnly ? `${iso}T00:00:00` : iso));

  if (!entity) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-20 rounded-lg animate-in fade-in duration-300" />
        <Skeleton className="h-24 rounded-lg animate-in fade-in duration-300" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 rounded-lg animate-in fade-in duration-300" />
          <Skeleton className="h-40 rounded-lg animate-in fade-in duration-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 duration-450 animate-in fade-in">
      <Link
        href="/legal-entities"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      {/* Шапка */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-light">
            <Building2 className="size-6 text-primary" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-col">
            <h1 className="break-words text-2xl font-bold">{entity.name}</h1>
            <span className="text-sm text-muted-foreground tabular-nums">
              {entity.establishment && `${entity.establishment} · `}
              {t("taxId")}: {entity.taxId}
            </span>
          </div>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="gap-2"
            >
              <Pencil className="size-4" />
              {t("edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              {t("delete")}
            </Button>
          </div>
        )}
      </div>

      {/* Адрес и даты */}
      <div className="flex flex-col gap-x-8 gap-y-3 rounded-lg border border-border p-4 sm:flex-row sm:flex-wrap">
        {entity.address && (
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
              <MapPin className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{t("address")}</span>
              <span className="text-sm font-medium">{entity.address}</span>
            </div>
          </div>
        )}
        {entity.registrationDate && (
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
              <CalendarDays className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                {t("registrationDate")}
              </span>
              <span className="text-sm font-medium tabular-nums">
                {formatDate(entity.registrationDate, true)}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
            <CalendarDays className="size-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{t("columnAdded")}</span>
            <span className="text-sm font-medium tabular-nums">
              {formatDate(entity.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Директор и реквизиты */}
      <div className="grid gap-4 lg:grid-cols-2">
        {entity.director && (
          <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                <UserRound className="size-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("director")}
              </h4>
            </div>
            <span className="font-medium">{directorName(entity.director)}</span>
          </section>
        )}

        {(entity.bank || entity.bankCode || entity.bankAccount) && (
          <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                <Landmark className="size-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("requisites")}
              </h4>
            </div>
            <dl className="flex flex-col gap-1 text-sm">
              {(
                [
                  [t("bank"), entity.bank],
                  [t("bankCode"), entity.bankCode],
                  [t("bankAccount"), entity.bankAccount],
                ] as const
              )
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-all text-right font-medium tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        )}

        {entity.establishment && (
          <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                <Store className="size-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("establishment")}
              </h4>
            </div>
            <span className="font-medium">{entity.establishment}</span>
          </section>
        )}
      </div>

      {/* Заведения этого ЮЛ */}
      {can(PERMISSIONS.venuesView) && <EntityVenues entityId={entity.id} />}

      {/* Участники */}
      {canManage && (
        <section className="rounded-lg border border-border p-5">
          <MembersManager
            entityId={entity.id}
            members={entity.members ?? []}
            onChanged={reload}
          />
        </section>
      )}

      <EntityFormDialog
        open={editing}
        entity={entity}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          reload();
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteConfirmTitle", { name: entity.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
