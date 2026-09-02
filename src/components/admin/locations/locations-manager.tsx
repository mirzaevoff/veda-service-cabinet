"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { ApiError } from "@/lib/api";
import type { Department, Office } from "@/lib/api";
import { locationsApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function LocationsManager() {
  const t = useTranslations("Locations");
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.locationsManage);

  const [offices, setOffices] = useState<Office[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [depts, setDepts] = useState<Record<string, Department[]>>({});
  const [addingOffice, setAddingOffice] = useState(false);

  const load = useCallback(() => {
    void locationsApi.offices().then(setOffices).catch(() => setOffices([]));
  }, []);
  useEffect(() => load(), [load]);

  const loadDepts = useCallback((officeId: string) => {
    void locationsApi
      .departments(officeId)
      .then((d) => setDepts((prev) => ({ ...prev, [officeId]: d })))
      .catch(() => {});
  }, []);

  function toggle(officeId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(officeId)) next.delete(officeId);
      else {
        next.add(officeId);
        if (!depts[officeId]) loadDepts(officeId);
      }
      return next;
    });
  }

  function officeError(e: unknown) {
    if (e instanceof ApiError && e.code === "ER1701") toast.error(t("nameTaken"));
    else if (e instanceof ApiError && e.code === "ER1702") toast.error(t("officeHasChildren"));
    else toast.error(t("genericError"));
  }
  function deptError(e: unknown) {
    if (e instanceof ApiError && e.code === "ER1704") toast.error(t("nameTaken"));
    else if (e instanceof ApiError && e.code === "ER1705") toast.error(t("deptHasEquipment"));
    else toast.error(t("genericError"));
  }

  if (!offices) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-11 rounded-lg" />
        <Skeleton className="h-11 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canManage && (
        <div className="flex justify-end">
          {addingOffice ? (
            <InlineAdd
              placeholder={t("officeName")}
              onSubmit={async (name) => {
                try {
                  await locationsApi.createOffice(name);
                  setAddingOffice(false);
                  load();
                } catch (e) {
                  officeError(e);
                }
              }}
              onCancel={() => setAddingOffice(false)}
            />
          ) : (
            <Button onClick={() => setAddingOffice(true)} className="gap-2">
              <Plus className="size-4" />
              {t("addOffice")}
            </Button>
          )}
        </div>
      )}

      {offices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-accent-light">
            <Building className="size-6 text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {offices.map((office) => {
            const isOpen = expanded.has(office.id);
            const list = depts[office.id];
            return (
              <div key={office.id} className="flex flex-col gap-0.5">
                <Row
                  icon={
                    <button
                      type="button"
                      onClick={() => toggle(office.id)}
                      className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary"
                    >
                      <ChevronRight
                        className={cn("size-4 transition-transform", isOpen && "rotate-90")}
                      />
                    </button>
                  }
                  name={office.name}
                  bold
                  canManage={canManage}
                  onRename={async (name) => {
                    try {
                      await locationsApi.updateOffice(office.id, name);
                      load();
                    } catch (e) {
                      officeError(e);
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await locationsApi.removeOffice(office.id);
                      load();
                    } catch (e) {
                      officeError(e);
                    }
                  }}
                />
                {isOpen && (
                  <div className="ml-8 flex flex-col gap-0.5">
                    {!list ? (
                      <Skeleton className="h-8 rounded-md" />
                    ) : (
                      list.map((dept) => (
                        <Row
                          key={dept.id}
                          name={dept.name}
                          canManage={canManage}
                          onRename={async (name) => {
                            try {
                              await locationsApi.updateDepartment(dept.id, name);
                              loadDepts(office.id);
                            } catch (e) {
                              deptError(e);
                            }
                          }}
                          onDelete={async () => {
                            try {
                              await locationsApi.removeDepartment(dept.id);
                              loadDepts(office.id);
                            } catch (e) {
                              deptError(e);
                            }
                          }}
                        />
                      ))
                    )}
                    {canManage && (
                      <InlineAdd
                        placeholder={t("deptName")}
                        compact
                        onSubmit={async (name) => {
                          try {
                            await locationsApi.createDepartment(office.id, name);
                            loadDepts(office.id);
                          } catch (e) {
                            deptError(e);
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  name,
  bold,
  canManage,
  onRename,
  onDelete,
}: {
  icon?: React.ReactNode;
  name: string;
  bold?: boolean;
  canManage: boolean;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const tc = useTranslations("Common");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <InlineAdd
        placeholder={name}
        initial={name}
        compact={!bold}
        onSubmit={async (v) => {
          await onRename(v);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5",
        bold ? "border border-border bg-card px-3 py-2" : "hover:bg-secondary/60"
      )}
    >
      {icon}
      <span className={cn("min-w-0 flex-1 truncate", bold ? "font-medium" : "text-sm")}>
        {name}
      </span>
      {canManage && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tc("edit")}
            onClick={() => setEditing(true)}
            className="text-muted-foreground"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tc("delete")}
            onClick={() => void onDelete()}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}

function InlineAdd({
  placeholder,
  initial = "",
  compact,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  initial?: string;
  compact?: boolean;
  onSubmit: (name: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const name = value.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onSubmit(name);
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-2", compact ? "py-0.5" : "")}>
      <Input
        autoFocus
        value={value}
        maxLength={120}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          if (e.key === "Escape") onCancel?.();
        }}
        className={compact ? "h-8" : undefined}
      />
      <Button size={compact ? "icon-sm" : "icon"} disabled={busy} onClick={() => void submit()}>
        <Plus className="size-4" />
      </Button>
      {onCancel && (
        <Button variant="ghost" size={compact ? "icon-sm" : "icon"} onClick={onCancel}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
