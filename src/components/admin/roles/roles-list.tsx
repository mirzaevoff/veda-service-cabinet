"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/page-header";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { RoleFormDialog } from "./role-form-dialog";
import { RoleDeleteDialog } from "./role-delete-dialog";
import type { PermissionDef, Role } from "@/lib/api";
import { adminApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useRouter } from "@/i18n/navigation";
import { useDelayed } from "@/hooks/use-delayed";
import { pickLocalized } from "@/lib/format";

export function RolesList({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("AdminRoles");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.rolesManage);

  const [roles, setRoles] = useState<Role[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const showSkeleton = useDelayed(!roles);

  const load = useCallback(async () => {
    try {
      setRoles(await adminApi.roles.list());
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
    if (role.permissions.includes("*")) return t("allPermissions");
    return t("permissionsCount", { count: role.permissions.length });
  }

  const createButton = canManage && (
    <Button onClick={() => setEditing("new")} className="gap-2">
      <Plus className="size-4" />
      {t("createRole")}
    </Button>
  );

  return (
    <div className={embedded ? undefined : "mx-auto max-w-3xl"}>
      {embedded ? (
        createButton && <div className="mb-4 flex justify-end">{createButton}</div>
      ) : (
        <PageHeader title={t("title")} description={t("description")}>
          {createButton}
        </PageHeader>
      )}

      {!roles ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {roles.map((role, i) => (
            <Card
              key={role.id}
              className="flex-row items-center gap-4 rounded-lg p-4 duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
              style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light">
                <ShieldCheck className="size-5 text-primary" strokeWidth={1.75} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {pickLocalized(role.title, locale) || role.slug}
                  </span>
                  <span className="text-xs text-muted-foreground">{role.slug}</span>
                  {role.isSystem && (
                    <Badge variant="secondary">{t("systemBadge")}</Badge>
                  )}
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {role.description || permissionsLabel(role)}
                  {role.description && ` · ${permissionsLabel(role)}`}
                </span>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("editRole")}
                    onClick={() => setEditing(role)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {!role.isSystem && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("delete")}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleting(role)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <RoleFormDialog
        role={editing}
        permissions={permissions}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
      <RoleDeleteDialog
        role={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          void load();
        }}
      />
    </div>
  );
}
