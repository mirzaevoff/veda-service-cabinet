"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Flame } from "lucide-react";
import type { Ticket } from "@/lib/api";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Цветной бейдж важности (staff-only) */
export function SeverityBadge({
  severity,
  className,
}: {
  severity: NonNullable<Ticket["severity"]>;
  className?: string;
}) {
  const locale = useLocale();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
        className
      )}
      style={{
        color: severity.color,
        backgroundColor: `${severity.color}1f`,
      }}
    >
      {pickLocalized(severity.name, locale)}
    </span>
  );
}

/** «до дедлайна N мин» / «SLA нарушен» для staff-карточек */
export function SlaIndicator({ ticket }: { ticket: Ticket }) {
  const t = useTranslations("Tickets.sla");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (ticket.slaBreached) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-destructive">
        <Flame className="size-3.5" />
        {t("breached")}
      </span>
    );
  }
  if (!ticket.slaDeadline || ticket.status !== "open") return null;
  // Оба таймера закрыты — дедлайн больше не грозит
  if (ticket.claimedAt && ticket.firstSupportReplyAt) return null;

  const minutes = Math.ceil(
    (new Date(ticket.slaDeadline).getTime() - now) / 60_000
  );
  if (minutes <= 0) return null; // вотчер вот-вот пометит красным
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-medium tabular-nums",
        minutes <= 15 ? "text-destructive" : "text-warning"
      )}
    >
      {t("deadline", { minutes })}
    </span>
  );
}
