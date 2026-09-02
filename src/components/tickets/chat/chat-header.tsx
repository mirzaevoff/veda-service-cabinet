"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ChevronDown, LogOut, UsersRound, WifiOff } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { TicketStatusBadge } from "../ticket-status-badge";
import { SeverityBadge, SlaIndicator } from "../severity-badge";
import { useSocketConnected } from "@/hooks/use-ticket-socket";
import type { Ticket, TicketSeverity } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { severitiesApi, ticketsApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { fullName, pickLocalized } from "@/lib/format";
import { getCached, setCached } from "@/lib/list-cache";

export function ChatHeader({
  ticket,
  onUpdated,
}: {
  ticket: Ticket;
  onUpdated: (ticket: Ticket) => void;
}) {
  const t = useTranslations("Tickets.chat");
  const locale = useLocale();
  const te = useTranslations("Tickets.errors");
  const { user, can } = useCurrentUser();
  const connected = useSocketConnected();
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const isAuthor = user?.id === ticket.author.id;
  const isManager = can(PERMISSIONS.ticketsManage);
  const isStaffViewer = can(PERMISSIONS.ticketsList);
  const canAnswer = can(PERMISSIONS.ticketsAnswer);
  const isParticipant = !!ticket.participants?.some(
    (p) => p.user.id === user?.id
  );
  // Закрытие просроченной заявки сотрудником (не автором) требует причину (ER414)
  const needSlaReason = !!ticket.slaBreached && !isAuthor;

  const [severities, setSeverities] = useState<TicketSeverity[]>(
    () => getCached<TicketSeverity[]>("ticket-severities") ?? []
  );
  useEffect(() => {
    if (!canAnswer) return;
    severitiesApi
      .list()
      .then((items) => {
        setSeverities(items);
        setCached("ticket-severities", items);
      })
      .catch(() => {});
  }, [canAnswer]);

  async function update(patch: {
    status?: "open" | "closed";
    slaBreachReason?: string;
  }) {
    setBusy(true);
    try {
      onUpdated(await ticketsApi.update(ticket.id, patch));
      setCloseOpen(false);
      setCloseReason("");
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER408") toast.error(te("ER408"));
      else if (e instanceof ApiError && e.code === "ER414")
        toast.error(t("slaReasonRequired"));
      else toast.error(te("generic"));
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    try {
      onUpdated(await ticketsApi.claim(ticket.id));
      toast.success(t("claimed"));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER412") toast.error(te("ER412"));
      else if (e instanceof ApiError && e.code === "ER409")
        toast.error(te("ER409"));
      else toast.error(te("generic"));
    } finally {
      setBusy(false);
    }
  }

  async function unclaim() {
    setBusy(true);
    try {
      onUpdated(await ticketsApi.unclaim(ticket.id));
      toast.success(t("left"));
    } catch {
      toast.error(te("generic"));
    } finally {
      setBusy(false);
    }
  }

  async function changeSeverity(severityId: string) {
    if (severityId === ticket.severity?.id) return;
    setBusy(true);
    try {
      onUpdated(await ticketsApi.setSeverity(ticket.id, severityId));
      toast.success(t("severityChanged"));
    } catch {
      toast.error(te("generic"));
    } finally {
      setBusy(false);
    }
  }

  const participantNames = (ticket.participants ?? [])
    .map((p) => fullName(p.user))
    .join(", ");

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-background px-3 py-3 sm:px-4">
      <div className="flex items-center gap-2">
        <Link href="/tickets" className="shrink-0">
          <Button variant="ghost" size="icon" aria-label={t("back")}>
            <ArrowLeft className="size-4.5" />
          </Button>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold">{ticket.subject}</h2>
            <TicketStatusBadge status={ticket.status} />
            {ticket.severity &&
              (canAnswer && severities.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        disabled={busy}
                        className="flex items-center gap-0.5"
                        aria-label={t("changeSeverity")}
                      >
                        <SeverityBadge severity={ticket.severity} />
                        <ChevronDown className="size-3 text-muted-foreground" />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="start">
                    {severities.map((severity) => (
                      <DropdownMenuItem
                        key={severity.id}
                        onClick={() => changeSeverity(severity.id)}
                      >
                        <span style={{ color: severity.color }}>
                          {pickLocalized(severity.name, locale)}
                        </span>
                        <span className="ms-auto ps-3 text-xs text-muted-foreground">
                          {severity.slaMinutes} {t("minShort")}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SeverityBadge severity={ticket.severity} />
              ))}
            <SlaIndicator ticket={ticket} />
            {!connected && (
              <span className="flex items-center gap-1 text-xs text-warning">
                <WifiOff className="size-3.5" />
                {t("reconnecting")}
              </span>
            )}
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {pickLocalized(ticket.category, locale)}
            {ticket.subcategory && ` · ${pickLocalized(ticket.subcategory, locale)}`}
            {ticket.legalEntity &&
              ` · ${
                ticket.legalEntity.establishment
                  ? `${ticket.legalEntity.establishment} · ${ticket.legalEntity.name}`
                  : ticket.legalEntity.name
              }`}
            {isStaffViewer && !isAuthor && ` · ${ticket.author.name} ${ticket.author.phone}`}
          </span>
          {isStaffViewer && (
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <UsersRound className="size-3" />
              {participantNames || t("noParticipants")}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canAnswer && !isAuthor && ticket.status === "open" && !isParticipant && (
            <Button variant="outline" size="sm" disabled={busy} onClick={claim}>
              {t("takeToWork")}
            </Button>
          )}
          {canAnswer && isParticipant && ticket.status === "open" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={unclaim}
              className="gap-1.5 text-muted-foreground"
            >
              <LogOut className="size-4" />
              {t("leave")}
            </Button>
          )}
          {(isManager || isParticipant) && ticket.status === "closed" && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => update({ status: "open" })}
            >
              {t("reopen")}
            </Button>
          )}
          {(isAuthor || isParticipant || isManager) && ticket.status === "open" && (
            <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
              <AlertDialogTrigger
                render={
                  <Button variant="ghost" size="sm" disabled={busy} className="text-muted-foreground">
                    {t("closeTicket")}
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("closeConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {needSlaReason ? t("slaReasonHint") : t("closeConfirmText")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {needSlaReason && (
                  <textarea
                    autoFocus
                    value={closeReason}
                    maxLength={500}
                    rows={3}
                    placeholder={t("slaReasonPlaceholder")}
                    onChange={(e) => setCloseReason(e.target.value)}
                    className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={busy || (needSlaReason && !closeReason.trim())}
                    onClick={(e) => {
                      // не закрывать диалог автоматически — ждём ответа API
                      e.preventDefault();
                      void update({
                        status: "closed",
                        slaBreachReason: needSlaReason ? closeReason.trim() : undefined,
                      });
                    }}
                  >
                    {t("closeTicket")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
