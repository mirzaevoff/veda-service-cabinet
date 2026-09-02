"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link2, Loader2, Network, Plus, Search, Store, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { ApiError, type Venue, type VenueStatus } from "@/lib/api";
import { legalEntitiesApi, venuesApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

const VENUE_STATUS_STYLES: Record<VenueStatus, string> = {
  open: "bg-success-light text-success",
  closed: "bg-secondary text-muted-foreground",
  temporarily_closed: "bg-warning-light text-warning",
  unknown: "bg-secondary text-muted-foreground",
};

/** Диалог поиска и привязки заведения к юрлицу */
function AttachVenueDialog({
  entityId,
  open,
  onClose,
  onAttached,
}: {
  entityId: string;
  open: boolean;
  onClose: () => void;
  onAttached: () => void;
}) {
  const t = useTranslations("LegalEntities.venues");
  const tc = useTranslations("Common");
  const tv = useTranslations("Venues");
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350);
  const [options, setOptions] = useState<Venue[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при открытии
    setQ("");
    setOptions(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    venuesApi
      .list({ search: debounced || undefined, limit: 20 })
      .then((page) => !cancelled && setOptions(page.items))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  async function attach(venue: Venue) {
    setBusyId(venue.id);
    try {
      await legalEntitiesApi.attachVenue(entityId, venue.id);
      toast.success(t("attached"));
      onAttached();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1401")
        toast.error(t("errorER1401"));
      else toast.error(t("errorGeneric"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("attachTitle")}</DialogTitle>
          <DialogDescription>{t("attachHint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>

          {!options ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : options.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("notFound")}
            </p>
          ) : (
            <div className="-mr-1 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
              {options.map((venue) => {
                const here = venue.legalEntity?.id === entityId;
                const elsewhere = !!venue.legalEntity && !here;
                return (
                  <button
                    key={venue.id}
                    type="button"
                    disabled={here || busyId !== null}
                    onClick={() => void attach(venue)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors",
                      here
                        ? "cursor-default opacity-60"
                        : "hover:border-primary/40"
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 truncate font-medium">
                          {venue.name}
                        </span>
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
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        {venue.uid}
                        {venue.city && ` · ${venue.city}`}
                        {elsewhere && venue.legalEntity && (
                          <span className="text-warning">
                            {" · "}
                            {t("linkedTo", { name: venue.legalEntity.name })}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0">
                      {busyId === venue.id ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : here ? (
                        <span className="text-xs text-muted-foreground">
                          {t("alreadyHere")}
                        </span>
                      ) : (
                        <Plus className="size-4 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Заведения, привязанные к этому ЮЛ (видно при праве venues.view) */
export function EntityVenues({ entityId }: { entityId: string }) {
  const t = useTranslations("LegalEntities.venues");
  const tv = useTranslations("Venues");
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.venuesManage);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    venuesApi
      .list({ legalEntityId: entityId, limit: 100 })
      .then((page) => !cancelled && setVenues(page.items))
      .catch(() => !cancelled && setVenues([]));
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  useEffect(() => load(), [load]);

  async function detach(venue: Venue) {
    setDetachingId(venue.id);
    try {
      await legalEntitiesApi.detachVenue(entityId, venue.id);
      setVenues((prev) => prev?.filter((v) => v.id !== venue.id) ?? prev);
      toast.success(t("detached"));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1401")
        toast.error(t("errorER1401"));
      else toast.error(t("errorGeneric"));
    } finally {
      setDetachingId(null);
    }
  }

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
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAttaching(true)}
          >
            <Link2 className="size-3.5" />
            {t("attach")}
          </Button>
        )}
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
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setAttaching(true)}
            >
              <Link2 className="size-3.5" />
              {t("attach")}
            </Button>
          )}
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
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  disabled={detachingId === venue.id}
                  onClick={() => void detach(venue)}
                  aria-label={t("detachAria")}
                >
                  {detachingId === venue.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <AttachVenueDialog
        entityId={entityId}
        open={attaching}
        onClose={() => setAttaching(false)}
        onAttached={load}
      />
    </section>
  );
}
