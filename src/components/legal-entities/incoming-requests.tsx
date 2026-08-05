"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Inbox, UserRound } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EntityFormDialog } from "./entity-form-dialog";
import type { AccessRequest, EntityMemberRole } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { accessRequestsApi } from "@/lib/api-authed";
import { formatRelativeTime, fullName } from "@/lib/format";

/**
 * Входящие запросы доступа: owner видит запросы по своим ЮЛ,
 * ТП (staff) — по всем + переключатель «без организации» и ER804-флоу
 * (создать ЮЛ по ИНН и повторить одобрение).
 */
export function IncomingRequests({
  staff,
  onDecided,
}: {
  staff: boolean;
  /** Дёргается после approve/reject — родитель может обновить связанные списки */
  onDecided?: () => void;
}) {
  const t = useTranslations("LegalEntities.access");
  const locale = useLocale();

  const [items, setItems] = useState<AccessRequest[] | null>(null);
  const [unassigned, setUnassigned] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  /** ER804: запрос, ради которого создаём ЮЛ; после сохранения — повторный approve */
  const [creatingFor, setCreatingFor] = useState<{
    request: AccessRequest;
    role: EntityMemberRole;
  } | null>(null);

  const reload = useCallback(() => {
    accessRequestsApi
      .incoming({ status: "pending", unassigned: unassigned || undefined, limit: 50 })
      .then((page) => setItems(page.items))
      .catch(() => setItems([]));
  }, [unassigned]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс списка при смене фильтра
    setItems(null);
    reload();
  }, [reload]);

  async function approve(request: AccessRequest, role: EntityMemberRole) {
    setBusyId(request.id);
    try {
      await accessRequestsApi.approve(request.id, role);
      toast.success(t("approved"));
      reload();
      onDecided?.();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER804" && staff) {
        toast.info(t("errors.ER804"));
        setCreatingFor({ request, role });
      } else if (e instanceof ApiError && e.code === "ER803") {
        toast.error(t("errors.ER803"));
        reload();
      } else toast.error(t("errors.generic"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await accessRequestsApi.reject(rejecting.id, rejectReason.trim() || undefined);
      toast.success(t("rejected"));
      setRejecting(null);
      setRejectReason("");
      reload();
      onDecided?.();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER803") {
        toast.error(t("errors.ER803"));
        setRejecting(null);
        reload();
      } else toast.error(t("errors.generic"));
    } finally {
      setBusyId(null);
    }
  }

  // Owner без входящих — секцию не показываем вовсе
  if (!staff && items !== null && items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          {t("incomingTitle")}
          {(items?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="bg-accent-light text-primary">
              {items!.length}
            </Badge>
          )}
        </h3>
        {staff && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={unassigned} onCheckedChange={setUnassigned} />
            {t("unassignedOnly")}
          </label>
        )}
      </div>

      {!items ? (
        <Skeleton className="h-20 rounded-lg" />
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
          <Inbox className="size-4.5" />
          {t("incomingEmpty")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 duration-300 animate-in fade-in sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                  <UserRound className="size-4 text-primary" />
                  {request.user ? fullName(request.user) : "—"}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {request.user?.phone}
                  </span>
                </span>
                <span className="text-sm">
                  {request.entityName ||
                    t("unknownEntity", { taxId: request.taxId })}
                </span>
                {request.comment && (
                  <span className="text-xs text-muted-foreground">
                    «{request.comment}»
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(request.createdAt, locale)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" disabled={busyId === request.id} className="gap-1.5">
                        {busyId === request.id ? (
                          <Spinner className="size-4" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        {t("approve")}
                        <ChevronDown className="size-3.5" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => approve(request, "member")}>
                      {t("approveAsMember")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => approve(request, "owner")}>
                      {t("approveAsOwner")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === request.id}
                  onClick={() => setRejecting(request)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {t("reject")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Отклонение с причиной */}
      <Dialog
        open={!!rejecting}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>
              {rejecting &&
                (rejecting.entityName ||
                  t("unknownEntity", { taxId: rejecting.taxId }))}
              {rejecting?.user && ` — ${fullName(rejecting.user)}`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            maxLength={500}
            rows={3}
            autoFocus
            placeholder={t("rejectReasonPlaceholder")}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={reject}
              disabled={busyId === rejecting?.id}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ER804: создаём ЮЛ по ИНН из запроса, затем повторяем approve */}
      {staff && (
        <EntityFormDialog
          open={!!creatingFor}
          entity={null}
          initialTaxId={creatingFor?.request.taxId}
          onClose={() => setCreatingFor(null)}
          onSaved={() => {
            const pending = creatingFor;
            setCreatingFor(null);
            if (pending) void approve(pending.request, pending.role);
          }}
        />
      )}
    </section>
  );
}
