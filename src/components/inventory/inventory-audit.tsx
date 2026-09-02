"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, CircleCheck, Lock, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { UserPicker } from "@/components/common/user-picker";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { auditStatusStyle } from "./inventory-format";
import type {
  Department,
  DictionaryItem,
  InventoryAudit,
  InventoryItem,
} from "@/lib/api";
import { ApiError } from "@/lib/api";
import {
  equipmentApi,
  inventoryApi,
  locationsApi,
  SessionExpiredError,
} from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function InventoryAuditPage({ auditId }: { auditId: string }) {
  const t = useTranslations("Inventory");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.inventoryManage);
  const canApprove = can(PERMISSIONS.inventoryApprove);

  const [audit, setAudit] = useState<InventoryAudit | null>(null);
  const [statuses, setStatuses] = useState<DictionaryItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);

  const load = useCallback(() => {
    inventoryApi
      .get(auditId)
      .then(setAudit)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    void equipmentApi.statuses().then(setStatuses).catch(() => {});
  }, []);
  useEffect(() => {
    if (!audit) return;
    void locationsApi
      .departments(audit.office.id)
      .then(setDepartments)
      .catch(() => {});
  }, [audit?.office.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const readonly = !canManage || audit?.status === "approved";

  async function patchItem(itemId: string, body: Parameters<typeof inventoryApi.updateItem>[2]) {
    try {
      const updated = await inventoryApi.updateItem(auditId, itemId, body);
      setAudit(updated.items ? updated : await inventoryApi.get(auditId));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1902") toast.error(t("lockedError"));
      else toast.error(t("genericError"));
    }
  }

  async function setStatus(status: "draft" | "completed") {
    setBusy(true);
    try {
      setAudit(await inventoryApi.update(auditId, { status }));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    try {
      setAudit(await inventoryApi.approve(auditId));
      setConfirmApprove(false);
      toast.success(t("approved"));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1902") toast.error(t("lockedError"));
      else toast.error(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await inventoryApi.remove(auditId);
      toast.success(t("deleted"));
      router.replace("/inventory");
    } catch {
      toast.error(t("genericError"));
    }
  }

  if (!audit) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const fmtDateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso)
    );

  const c = audit.counts;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <Link
        href="/inventory"
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      {/* Шапка */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold">
              {audit.office.name}
              {audit.department && (
                <span className="text-muted-foreground"> · {audit.department.name}</span>
              )}
            </h1>
            <Badge variant="secondary" className={cn(auditStatusStyle(audit.status))}>
              {t(`status.${audit.status}`)}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {t("createdBy", { name: audit.createdBy?.name ?? "—" })}
            {" · "}
            {fmtDateTime(audit.createdAt)}
          </span>
          {audit.status === "approved" && audit.approvedBy && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Lock className="size-3.5" />
              {t("approvedBy", {
                name: audit.approvedBy.name,
                date: audit.approvedAt ? fmtDateTime(audit.approvedAt) : "",
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canManage && audit.status === "draft" && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void setStatus("completed")}>
              {t("markCompleted")}
            </Button>
          )}
          {canManage && audit.status === "completed" && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void setStatus("draft")}>
              {t("backToDraft")}
            </Button>
          )}
          {canApprove && audit.status !== "approved" && (
            <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => setConfirmApprove(true)}>
              <CircleCheck className="size-4" />
              {t("approve")}
            </Button>
          )}
          {canManage && audit.status !== "approved" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tc("delete")}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["total", c.total, ""],
            ["checked", c.checked, ""],
            ["present", c.present, "text-success"],
            ["missing", c.missing, c.missing > 0 ? "text-primary" : ""],
            ["discrepancies", c.discrepancies, c.discrepancies > 0 ? "text-warning" : ""],
          ] as const
        ).map(([key, val, tone]) => (
          <div key={key} className="flex flex-col gap-0.5 rounded-lg border border-border p-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {t(`count.${key}`)}
            </span>
            <span className={cn("text-xl font-bold tabular-nums", tone)}>{val}</span>
          </div>
        ))}
      </div>

      {/* Позиции */}
      <div className="flex flex-col gap-2">
        {(audit.items ?? []).map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            statuses={statuses}
            departments={departments}
            readonly={readonly}
            onPatch={(body) => patchItem(item.id, body)}
          />
        ))}
        {(audit.items ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noItems")}</p>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void remove()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("approveConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("approveConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void approve()}>
              {busy ? <Spinner className="size-4" /> : t("approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemRow({
  item,
  statuses,
  departments,
  readonly,
  onPatch,
}: {
  item: InventoryItem;
  statuses: DictionaryItem[];
  departments: Department[];
  readonly: boolean;
  onPatch: (body: Parameters<typeof inventoryApi.updateItem>[2]) => Promise<void>;
}) {
  const t = useTranslations("Inventory");
  const [note, setNote] = useState(item.note);

  const presentBtn = (val: boolean | null, label: string) => (
    <button
      type="button"
      disabled={readonly}
      onClick={() => void onPatch({ present: val })}
      className={cn(
        "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        item.present === val
          ? val === true
            ? "bg-success-light text-success"
            : val === false
              ? "bg-accent-light text-primary"
              : "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary",
        readonly && "cursor-not-allowed opacity-70"
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4",
        item.discrepancy ? "border-warning/40 bg-warning-light/20" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 font-medium">
            <span className="truncate">{item.name}</span>
            {item.discrepancy && (
              <Badge variant="secondary" className="bg-warning-light text-warning">
                {t("discrepancy")}
              </Badge>
            )}
          </span>
          {(item.serialNumber || item.inventoryNumber) && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {[item.serialNumber && `S/N ${item.serialNumber}`, item.inventoryNumber && `№ ${item.inventoryNumber}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          <span className="mt-1 text-xs text-muted-foreground">
            {t("expected")}: {item.expectedStatus?.name ?? "—"}
            {item.expectedResponsible && ` · ${item.expectedResponsible.name}`}
            {item.expectedDepartment && ` · ${item.expectedDepartment.name}`}
          </span>
        </div>
        <div className="flex w-40 shrink-0 gap-1 rounded-md border border-border p-0.5">
          {presentBtn(null, t("notChecked"))}
          {presentBtn(true, t("present"))}
          {presentBtn(false, t("missing"))}
        </div>
      </div>

      {item.present === true && (
        <div className="grid gap-2 sm:grid-cols-3">
          <ActualSelect
            label={t("actualStatus")}
            value={item.actualStatus?.id ?? NONE}
            items={statuses}
            readonly={readonly}
            onChange={(v) => void onPatch({ actualStatusId: v === NONE ? null : v })}
          />
          <ActualSelect
            label={t("actualDepartment")}
            value={item.actualDepartment?.id ?? NONE}
            items={departments}
            readonly={readonly}
            onChange={(v) => void onPatch({ actualDepartmentId: v === NONE ? null : v })}
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("actualResponsible")}</span>
            <UserPicker
              value={item.actualResponsible ? { id: item.actualResponsible.id, name: item.actualResponsible.name } : null}
              onChange={(u) => void onPatch({ actualResponsibleId: u ? u.id : null })}
              placeholder={t("asExpected")}
              disabled={readonly}
            />
          </div>
        </div>
      )}

      {item.present !== null && (
        <Input
          value={note}
          maxLength={1000}
          disabled={readonly}
          placeholder={t("itemNote")}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== item.note && void onPatch({ note })}
          className="h-8"
        />
      )}
    </div>
  );
}

function ActualSelect({
  label,
  value,
  items,
  readonly,
  onChange,
}: {
  label: string;
  value: string;
  items: { id: string; name: string }[];
  readonly: boolean;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("Inventory");
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select
        value={value}
        items={{ [NONE]: t("asExpected"), ...Object.fromEntries(items.map((i) => [i.id, i.name])) }}
        onValueChange={(v) => onChange(v ?? NONE)}
        disabled={readonly}
      >
        <SelectTrigger className="h-8 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("asExpected")}</SelectItem>
          {items.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
