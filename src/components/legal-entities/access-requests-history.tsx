"use client";

import { useLocale, useTranslations } from "next-intl";
import { Building2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AccessRequest, AccessRequestStatus } from "@/lib/api";
import { accessRequestsApi } from "@/lib/api-authed";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AccessRequestStatus, string> = {
  pending: "bg-warning-light text-warning",
  approved: "bg-success-light text-success",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-secondary text-muted-foreground",
};

export function RequestStatusBadge({ status }: { status: AccessRequestStatus }) {
  const t = useTranslations("LegalEntities.access.status");
  return (
    <Badge variant="secondary" className={cn("shrink-0", STATUS_STYLES[status])}>
      {t(status)}
    </Badge>
  );
}

/** История запросов доступа текущего пользователя */
export function AccessRequestsHistory({
  requests,
  onChanged,
}: {
  requests: AccessRequest[];
  onChanged: () => void;
}) {
  const t = useTranslations("LegalEntities.access");
  const locale = useLocale();

  async function cancel(id: string) {
    try {
      await accessRequestsApi.cancel(id);
      toast.success(t("cancelled"));
      onChanged();
    } catch {
      toast.error(t("errors.generic"));
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {requests.map((request) => (
        <div
          key={request.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-border px-4 py-3 duration-300 animate-in fade-in",
            request.status !== "pending" && "opacity-70"
          )}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light">
            <Building2 className="size-4.5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">
                {request.entityName || t("unknownEntity", { taxId: request.taxId })}
              </span>
              <RequestStatusBadge status={request.status} />
            </span>
            <span className="text-xs text-muted-foreground">
              {t("requestedAt", {
                time: formatRelativeTime(request.createdAt, locale),
              })}
              {request.status === "rejected" && request.rejectReason && (
                <> · {t("rejectedReason", { reason: request.rejectReason })}</>
              )}
            </span>
          </div>
          {request.status === "pending" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("cancel")}
              onClick={() => cancel(request.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
