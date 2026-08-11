"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Lock, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { RoleEditor } from "./role-editor";
import { RoleDeleteDialog } from "./role-delete-dialog";
import type { PermissionDef, Role } from "@/lib/api";
import { adminApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useRouter } from "@/i18n/navigation";
import { useDelayed } from "@/hooks/use-delayed";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Роли и доступы: слева карточки ролей, справа редактор выбранной */
export function RolesList({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("AdminRoles");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.rolesManage);

  const [roles, setRoles] = useState<Role[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  /** id роли, "new" — создание */
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const showSkeleton = useDelayed(!roles);

  const load = useCallback(async () => {
    try {
      // Ролей мало и они приходят целиком — сортируем на клиенте
      const list = await adminApi.roles.list();
      const sorted = [...list].sort((a, b) =>
        (a.title.ru || a.slug).localeCompare(b.title.ru || b.slug)
      );
      setRoles(sorted);
      setSelected((prev) =>
        prev && (prev === "new" || sorted.some((r) => r.id === prev))
          ? prev
          : (sorted[0]?.id ?? null)
      );
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/tc нестабильны, методы стабильны
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState после await
    void load();
    adminApi.roles.permissions().then(setPermissions).catch(() => {});
  }, [load]);

  function permissionsLabel(role: Role) {
    if (role.permissions.includes("*")) return t("fullAccess");
    return t("permissionsCount", { count: role.permissions.length });
  }

  const selectedRole =
    selected !== null && selected !== "new"
      ? (roles?.find((r) => r.id === selected) ?? null)
      : null;

  const list = (
    <div className="flex w-full shrink-0 flex-col gap-2 lg:w-72">
      {canManage && (
        <Button
          variant={selected === "new" ? "default" : "outline"}
          onClick={() => setSelected("new")}
          className="gap-2"
        >
          <Plus className="size-4" />
          {t("createRole")}
        </Button>
      )}
      {(roles ?? []).map((role, i) => {
        const active = selected === role.id;
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelected(role.id)}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border border-border p-4 text-left transition-colors duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]",
              active
                ? "border-primary/50 bg-accent-light/40"
                : "hover:border-primary/30"
            )}
            style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
          >
            <div className="flex w-full items-center gap-2">
              <ShieldCheck
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                strokeWidth={1.75}
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {pickLocalized(role.title, locale) || role.slug}
              </span>
              {role.isSystem && (
                <Lock className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </div>
            <code className="text-xs text-muted-foreground">{role.slug}</code>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className={cn(
                  "tabular-nums",
                  role.permissions.includes("*") &&
                    "bg-accent-light text-primary"
                )}
              >
                {permissionsLabel(role)}
              </Badge>
              <Badge variant="secondary" className="text-muted-foreground">
                {role.isSystem ? t("systemBadge") : t("customBadge")}
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={embedded ? undefined : "mx-auto max-w-6xl"}>
      {!embedded && <PageHeader title={t("title")} description={t("description")} />}

      {!roles ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          {showSkeleton && (
            <>
              <div className="flex w-full shrink-0 flex-col gap-2 lg:w-72">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg animate-in fade-in duration-300" />
                ))}
              </div>
              <Skeleton className="h-96 flex-1 rounded-lg animate-in fade-in duration-300" />
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {list}
          {selected === "new" ? (
            <RoleEditor
              key="new"
              role={null}
              permissions={permissions}
              canManage={canManage}
              onSaved={() => {
                setSelected(null);
                void load();
              }}
              onDelete={() => {}}
            />
          ) : selectedRole ? (
            <RoleEditor
              key={selectedRole.id}
              role={selectedRole}
              permissions={permissions}
              canManage={canManage}
              onSaved={() => void load()}
              onDelete={setDeleting}
            />
          ) : null}
        </div>
      )}

      <RoleDeleteDialog
        role={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          setSelected(null);
          void load();
        }}
      />
    </div>
  );
}
