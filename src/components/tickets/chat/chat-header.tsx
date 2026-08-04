"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, WifiOff } from "lucide-react";
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
import { useCurrentUser } from "@/components/common/current-user-provider";
import { TicketStatusBadge } from "../ticket-status-badge";
import { useSocketConnected } from "@/hooks/use-ticket-socket";
import type { Ticket } from "@/lib/api";
import { ticketsApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { pickLocalized } from "@/lib/format";

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

  const isAuthor = user?.id === ticket.author.id;
  const isManager = can(PERMISSIONS.ticketsManage);
  const isStaffViewer = can(PERMISSIONS.ticketsList);

  async function update(patch: { status?: "open" | "closed"; assigneeId?: string }) {
    setBusy(true);
    try {
      onUpdated(await ticketsApi.update(ticket.id, patch));
    } catch {
      toast.error(te("generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-background px-3 py-3 sm:px-4">
      <div className="flex items-center gap-2">
        <Link href="/tickets" className="shrink-0">
          <Button variant="ghost" size="icon" aria-label={t("back")}>
            <ArrowLeft className="size-4.5" />
          </Button>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{ticket.subject}</h2>
            <TicketStatusBadge status={ticket.status} />
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
            {isStaffViewer && !isAuthor && ` · ${ticket.author.name} ${ticket.author.phone}`}
            {ticket.assignee &&
              ` · ${t("assignee", { name: ticket.assignee.name })}`}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isManager && ticket.status === "open" && !ticket.assignee && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => update({ assigneeId: user!.id })}
            >
              {t("takeToWork")}
            </Button>
          )}
          {isManager && ticket.status === "closed" && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => update({ status: "open" })}
            >
              {t("reopen")}
            </Button>
          )}
          {(isAuthor || isManager) && ticket.status === "open" && (
            <AlertDialog>
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
                    {t("closeConfirmText")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => update({ status: "closed" })}>
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
