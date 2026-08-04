import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { TicketStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const t = useTranslations("Tickets.list");

  return (
    <Badge
      variant="secondary"
      className={cn(
        status === "open" && "bg-accent-light text-primary",
        className
      )}
    >
      {t(status === "open" ? "statusOpen" : "statusClosed")}
    </Badge>
  );
}
