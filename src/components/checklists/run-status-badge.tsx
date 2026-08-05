"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ChecklistRunStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const STYLES: Record<ChecklistRunStatus, string> = {
  pending: "bg-warning-light text-warning",
  in_progress: "bg-accent-light text-primary",
  completed: "bg-success-light text-success",
  missed: "bg-destructive/10 text-destructive",
  cancelled: "bg-secondary text-muted-foreground",
};

export function RunStatusBadge({
  status,
  late = false,
}: {
  status: ChecklistRunStatus;
  /** Завершён после срока — «выполнено не вовремя» */
  late?: boolean;
}) {
  const t = useTranslations("Checklists.runStatus");
  if (status === "completed" && late) {
    return (
      <Badge variant="secondary" className="shrink-0 bg-warning-light text-warning">
        {t("completedLate")}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn("shrink-0", STYLES[status])}>
      {t(status)}
    </Badge>
  );
}
