"use client";

import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { useTicketListEvents } from "@/hooks/use-ticket-socket";
import { notifyUnreadChanged } from "@/hooks/use-unread-tickets";
import { PERMISSIONS } from "@/lib/permissions";
import { pickLocalized } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";

/**
 * Живой тост о новом обращении для суппорта (на любой странице) — чтобы новый
 * тикет нельзя было пропустить (в дополнение к ленте/пушу и счётчику).
 * Ничего не рендерит; слушает сокет-событие `ticket:created`.
 */
export function TicketAlerts() {
  const t = useTranslations("Tickets.alerts");
  const locale = useLocale();
  const router = useRouter();
  const { user, can } = useCurrentUser();

  const isStaff =
    can(PERMISSIONS.ticketsAnswer) ||
    can(PERMISSIONS.ticketsManage) ||
    can(PERMISSIONS.ticketsList);

  useTicketListEvents({
    onCreated: (ticket) => {
      if (!isStaff) return;
      // свой же тикет не анонсируем автору
      if (ticket.author?.id === user?.id) return;
      notifyUnreadChanged();
      const category = pickLocalized(ticket.category, locale);
      toast.info(t("newTicket", { subject: ticket.subject }), {
        description: [category, ticket.author?.name].filter(Boolean).join(" · "),
        action: {
          label: t("open"),
          onClick: () => router.push(`/tickets/${ticket.id}`),
        },
      });
    },
  });

  return null;
}
