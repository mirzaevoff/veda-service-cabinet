"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { ApiError } from "@/lib/api";
import type { DictionaryItem } from "@/lib/api";
import { equipmentApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function EquipmentDictsManager() {
  const t = useTranslations("EquipmentDicts");
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.equipmentManage);

  const [categories, setCategories] = useState<DictionaryItem[] | null>(null);
  const [statuses, setStatuses] = useState<DictionaryItem[] | null>(null);

  const load = useCallback(() => {
    void equipmentApi.categories().then(setCategories).catch(() => setCategories([]));
    void equipmentApi.statuses().then(setStatuses).catch(() => setStatuses([]));
  }, []);
  useEffect(() => load(), [load]);

  function catError(e: unknown) {
    if (e instanceof ApiError && e.code === "ER1802") toast.error(t("nameTaken"));
    else if (e instanceof ApiError && e.code === "ER1803") toast.error(t("categoryInUse"));
    else toast.error(t("genericError"));
  }
  function statusError(e: unknown) {
    if (e instanceof ApiError && e.code === "ER1805") toast.error(t("nameTaken"));
    else if (e instanceof ApiError && e.code === "ER1806") toast.error(t("statusInUse"));
    else toast.error(t("genericError"));
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Категории */}
      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">{t("categories")}</h3>
        {!categories ? (
          <Skeleton className="h-20 rounded-md" />
        ) : (
          <div className="flex flex-col gap-1">
            {categories.map((c) => (
              <DictRow
                key={c.id}
                name={c.name}
                canManage={canManage}
                onRename={async (name) => {
                  try {
                    await equipmentApi.updateCategory(c.id, name);
                    load();
                  } catch (e) {
                    catError(e);
                  }
                }}
                onDelete={async () => {
                  try {
                    await equipmentApi.removeCategory(c.id);
                    load();
                  } catch (e) {
                    catError(e);
                  }
                }}
              />
            ))}
            {categories.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">{t("noCategories")}</p>
            )}
            {canManage && (
              <InlineAdd
                placeholder={t("categoryName")}
                onSubmit={async (name) => {
                  try {
                    await equipmentApi.createCategory(name);
                    load();
                  } catch (e) {
                    catError(e);
                  }
                }}
              />
            )}
          </div>
        )}
      </section>

      {/* Статусы */}
      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">{t("statuses")}</h3>
        {!statuses ? (
          <Skeleton className="h-20 rounded-md" />
        ) : (
          <div className="flex flex-col gap-1">
            {statuses.map((s) => (
              <DictRow
                key={s.id}
                name={s.name}
                badge={
                  s.isDefault ? (
                    <Badge variant="secondary" className="bg-accent-light text-primary">
                      {t("default")}
                    </Badge>
                  ) : undefined
                }
                canManage={canManage}
                extraAction={
                  canManage && !s.isDefault ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("makeDefault")}
                      title={t("makeDefault")}
                      onClick={async () => {
                        try {
                          await equipmentApi.updateStatus(s.id, { isDefault: true });
                          load();
                        } catch (e) {
                          statusError(e);
                        }
                      }}
                      className="text-muted-foreground"
                    >
                      <Star className="size-3.5" />
                    </Button>
                  ) : undefined
                }
                onRename={async (name) => {
                  try {
                    await equipmentApi.updateStatus(s.id, { name });
                    load();
                  } catch (e) {
                    statusError(e);
                  }
                }}
                onDelete={async () => {
                  try {
                    await equipmentApi.removeStatus(s.id);
                    load();
                  } catch (e) {
                    statusError(e);
                  }
                }}
              />
            ))}
            {canManage && (
              <InlineAdd
                placeholder={t("statusName")}
                onSubmit={async (name) => {
                  try {
                    await equipmentApi.createStatus(name);
                    load();
                  } catch (e) {
                    statusError(e);
                  }
                }}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DictRow({
  name,
  badge,
  extraAction,
  canManage,
  onRename,
  onDelete,
}: {
  name: string;
  badge?: React.ReactNode;
  extraAction?: React.ReactNode;
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
        onSubmit={async (v) => {
          await onRename(v);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/60">
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      {badge}
      {extraAction}
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
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  initial?: string;
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
    <div className={cn("flex items-center gap-1.5", initial ? "" : "mt-1")}>
      <Input
        autoFocus={!!initial}
        value={value}
        maxLength={100}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          if (e.key === "Escape") onCancel?.();
        }}
        className="h-8"
      />
      <Button size="icon-sm" disabled={busy} onClick={() => void submit()}>
        {initial ? <Check className="size-4" /> : <Plus className="size-4" />}
      </Button>
      {onCancel && (
        <Button variant="ghost" size="icon-sm" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
