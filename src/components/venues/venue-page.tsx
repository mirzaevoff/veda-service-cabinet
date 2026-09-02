"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity,
  ArrowLeft,
  Building2,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Link2Off,
  Network,
  RefreshCw,
  Search,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import {
  ApiError,
  type IikoServerStatus,
  type LegalEntity,
  type Venue,
  type VenueStatus,
} from "@/lib/api";
import {
  legalEntitiesApi,
  venuesApi,
  SessionExpiredError,
} from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { VenueInvoices } from "./venue-invoices";

const SERVER_STATUS_STYLES: Record<IikoServerStatus, string> = {
  up: "bg-success-light text-success",
  down: "bg-destructive/10 text-destructive",
  maintenance: "bg-warning-light text-warning",
  unknown: "bg-secondary text-muted-foreground",
};
const VENUE_STATUS_STYLES: Record<VenueStatus, string> = {
  open: "bg-success-light text-success",
  closed: "bg-secondary text-muted-foreground",
  temporarily_closed: "bg-warning-light text-warning",
  unknown: "bg-secondary text-muted-foreground",
};

function unescapePortal(value: string) {
  return value.replace(/\\(['"])/g, "$1");
}
function CodeChip({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

/** Страница заведения: статус, привязка ЮЛ, карточка iiko, счета */
export function VenuePage({ venueId }: { venueId: string }) {
  const t = useTranslations("Venues");
  const ts = useTranslations("IikoPartner.servers");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.venuesManage);
  const canPickEntity = can(PERMISSIONS.legalEntitiesList);
  const canInvoices =
    can(PERMISSIONS.iikoInvoicesView) ||
    can(PERMISSIONS.iikoPartnerInvoicesView);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [cardSyncing, setCardSyncing] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusUntil, setStatusUntil] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [picking, setPicking] = useState(false);
  const [entityQuery, setEntityQuery] = useState("");
  const debouncedEntityQuery = useDebouncedValue(entityQuery, 350);
  const [entityOptions, setEntityOptions] = useState<LegalEntity[] | null>(null);

  const load = useCallback(() => {
    venuesApi
      .get(venueId)
      .then(setVenue)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else {
          toast.error(t("errors.generic"));
          router.replace("/venues");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/router стабильны по смыслу
  }, [venueId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!picking) return;
    let cancelled = false;
    legalEntitiesApi
      .list({ search: debouncedEntityQuery || undefined, limit: 20 })
      .then((page) => {
        if (!cancelled) setEntityOptions(page.items);
      })
      .catch(() => {
        if (!cancelled) setEntityOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [picking, debouncedEntityQuery]);

  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  async function syncCard() {
    if (!venue) return;
    setCardSyncing(true);
    try {
      setVenue(await venuesApi.syncCard(venue.id));
      toast.success(t("cardSynced"));
    } catch {
      toast.error(t("syncError"));
    } finally {
      setCardSyncing(false);
    }
  }

  async function link(legalEntityId: string | null) {
    if (!venue) return;
    setLinking(true);
    try {
      setVenue(await venuesApi.linkLegalEntity(venue.id, legalEntityId));
      setPicking(false);
      toast.success(legalEntityId ? t("linked") : t("unlinked"));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER700") toast.error(t("errors.ER700"));
      else toast.error(t("errors.generic"));
    } finally {
      setLinking(false);
    }
  }

  async function setStatus(status: "temporarily_closed" | null) {
    if (!venue) return;
    setStatusBusy(true);
    try {
      setVenue(
        await venuesApi.setStatus(
          venue.id,
          status,
          status && statusUntil ? new Date(statusUntil).toISOString() : null
        )
      );
      setStatusDialogOpen(false);
      setStatusUntil("");
      toast.success(status ? t("markedClosed") : t("statusCleared"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setStatusBusy(false);
    }
  }

  if (!venue) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-20 rounded-lg animate-in fade-in duration-300" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 rounded-lg animate-in fade-in duration-300" />
          <Skeleton className="h-40 rounded-lg animate-in fade-in duration-300" />
        </div>
      </div>
    );
  }

  const externalLinks = [
    [t("hostingLink"), venue.hostingLink],
    [t("webLink"), venue.webLink],
  ] as const;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 duration-450 animate-in fade-in">
      <Link
        href="/venues"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      {/* Шапка */}
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-light">
          {venue.kind === "chain" ? (
            <Network className="size-6 text-primary" strokeWidth={1.75} />
          ) : (
            <Store className="size-6 text-primary" strokeWidth={1.75} />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="break-words text-2xl font-bold">{venue.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="secondary"
              className={cn(
                "gap-1",
                venue.kind === "chain" && "bg-accent-light text-primary"
              )}
            >
              {venue.kind === "chain" ? (
                <Network className="size-3" />
              ) : (
                <Store className="size-3" />
              )}
              {t(`kind.${venue.kind}`)}
            </Badge>
            {venue.kind === "rms" && (
              <Badge variant="secondary" className={VENUE_STATUS_STYLES[venue.status]}>
                {t(`status.${venue.status}`)}
              </Badge>
            )}
            {venue.server && (
              <Badge
                variant="secondary"
                className={SERVER_STATUS_STYLES[venue.server.status]}
              >
                {t("serverBadge", { status: ts(`status.${venue.server.status}`) })}
              </Badge>
            )}
            {!venue.active && (
              <Badge variant="secondary" className="text-muted-foreground">
                {t("inactive")}
              </Badge>
            )}
            {venue.chain && (
              <span className="text-xs text-muted-foreground">
                {t("inChain", { name: venue.chain.name })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Статус (ручной override) */}
        {canManage && venue.kind === "rms" && (
          <section className="flex flex-col gap-2.5 rounded-lg border border-border p-5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                <Activity className="size-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("statusSection")}
              </h4>
            </div>
            {venue.manualStatus ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm text-warning">
                  <Clock className="size-3.5 shrink-0" />
                  {venue.manualStatusUntil
                    ? t("tempClosedUntil", {
                        time: formatTime(venue.manualStatusUntil),
                      })
                    : t("tempClosedManual")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={statusBusy}
                  onClick={() => void setStatus(null)}
                >
                  {t("clearStatus")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("statusAutoHint")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusDialogOpen(true)}
                  className="gap-1.5"
                >
                  <Clock className="size-3.5" />
                  {t("markClosed")}
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Наше ЮЛ */}
        <section className="flex flex-col gap-2.5 rounded-lg border border-border p-5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Building2 className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("ourEntity")}
            </h4>
          </div>

          {venue.legalEntity ? (
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/legal-entities/${venue.legalEntity.id}`}
                className="flex min-w-0 items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary"
              >
                <Link2 className="size-3.5 shrink-0 text-success" />
                <span className="truncate">{venue.legalEntity.name}</span>
              </Link>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={linking}
                  onClick={() => void link(null)}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Link2Off className="size-3.5" />
                  {t("unlink")}
                </Button>
              )}
            </div>
          ) : picking ? (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={entityQuery}
                  onChange={(e) => setEntityQuery(e.target.value)}
                  placeholder={t("entitySearchPlaceholder")}
                  className="pl-9"
                />
              </div>
              {!entityOptions ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : entityOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("entityNotFound")}</p>
              ) : (
                <div className="-mr-1 flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
                  {entityOptions.map((entity) => (
                    <button
                      key={entity.id}
                      type="button"
                      disabled={linking}
                      onClick={() => void link(entity.id)}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
                    >
                      <span className="min-w-0 truncate font-medium">{entity.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {entity.taxId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPicking(false)}
                className="self-start"
              >
                {tc("cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{t("noEntity")}</span>
              {canManage && canPickEntity && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPicking(true)}
                  className="gap-1.5"
                >
                  <Link2 className="size-3.5" />
                  {t("link")}
                </Button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Карточка iiko */}
      <section className="flex flex-col gap-2.5 rounded-lg border border-border p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Store className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("iikoCard")}
            </h4>
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              disabled={cardSyncing}
              onClick={() => void syncCard()}
              className="gap-1.5"
            >
              {cardSyncing ? (
                <Spinner className="size-3.5" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {t("syncCard")}
            </Button>
          )}
        </div>
        <div className="grid gap-x-8 text-sm sm:grid-cols-2">
          <dl className="flex flex-col gap-1.5 border-b border-border pb-3 sm:border-b-0 sm:pb-0">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">{t("colUid")}</dt>
              <dd className="flex min-w-0 items-center gap-1.5">
                <CodeChip>{venue.uid}</CodeChip>
                <button
                  type="button"
                  aria-label={t("copyUid")}
                  onClick={() => {
                    void navigator.clipboard.writeText(venue.uid);
                    toast.success(t("uidCopied"));
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">{t("clientId")}</dt>
              <dd>
                <CodeChip>{venue.iikoClientId}</CodeChip>
              </dd>
            </div>
            {venue.version && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-muted-foreground">{t("version")}</dt>
                <dd>
                  <CodeChip>{venue.version}</CodeChip>
                </dd>
              </div>
            )}
            {venue.type && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-muted-foreground">{t("colType")}</dt>
                <dd className="min-w-0 text-right text-muted-foreground">
                  {venue.type}
                </dd>
              </div>
            )}
            {venue.city && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-muted-foreground">{t("colCity")}</dt>
                <dd className="min-w-0 text-right font-medium">{venue.city}</dd>
              </div>
            )}
          </dl>
          <dl className="flex flex-col gap-1.5 pt-3 sm:pt-0">
            {(
              [
                [t("phone"), venue.phone],
                [t("email"), venue.email],
                [t("emailForInvoices"), venue.emailForInvoices],
                [t("manager"), venue.manager],
                [t("iikoEntity"), unescapePortal(venue.iikoLegalEntityName)],
                [t("iikoTaxId"), venue.iikoTaxId],
              ] as const
            )
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            {venue.address && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t("address")}</dt>
                <dd className="break-words text-xs leading-relaxed text-muted-foreground">
                  {unescapePortal(venue.address)}
                </dd>
              </div>
            )}
          </dl>
        </div>
        {externalLinks.some(([, url]) => url) && (
          <div className="flex flex-wrap gap-2">
            {externalLinks
              .filter(([, url]) => url)
              .map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ExternalLink className="size-3" />
                  {label}
                </a>
              ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {venue.cardSyncedAt
            ? t("cardSyncedAt", { time: formatTime(venue.cardSyncedAt) })
            : t("cardNotSynced")}
        </p>
      </section>

      {/* Счета заведения */}
      {canInvoices && venue.kind === "rms" && (
        <VenueInvoices clientId={venue.iikoClientId} />
      )}

      {/* Точки сети */}
      {venue.kind === "chain" && (
        <Link href={`/venues?chainId=${venue.id}&chainName=${encodeURIComponent(venue.name)}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Store className="size-4" />
            {t("showChainPoints")}
          </Button>
        </Link>
      )}

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("markClosed")}</DialogTitle>
            <DialogDescription>{t("markClosedHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="venue-status-until"
              className="text-sm font-medium text-muted-foreground"
            >
              {t("untilLabel")}
            </Label>
            <Input
              id="venue-status-until"
              type="datetime-local"
              value={statusUntil}
              onChange={(e) => setStatusUntil(e.target.value)}
              className="w-fit"
            />
            <span className="text-xs text-muted-foreground">{t("untilHint")}</span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={() => void setStatus("temporarily_closed")}
              disabled={statusBusy}
            >
              {statusBusy ? <Spinner className="size-4" /> : t("markClosedNow")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
