"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Pencil, Search, Trash2, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { EntityFormDialog } from "./entity-form-dialog";
import { EntityRequisites } from "./entity-requisites";
import type { LegalEntity, UserProfile } from "@/lib/api";
import { adminApi, legalEntitiesApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";

export function EntityDrawer({
  entityId,
  onClose,
  onChanged,
}: {
  entityId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("LegalEntities");
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.legalEntitiesManage);
  const canSearchUsers = can(PERMISSIONS.usersList);

  const [entity, setEntity] = useState<LegalEntity | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const debouncedSearch = useDebouncedValue(userSearch, 400);
  const [found, setFound] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при смене ЮЛ
    setEntity(null);
    setUserSearch("");
    if (entityId) {
      legalEntitiesApi
        .get(entityId)
        .then(setEntity)
        .catch(() => {
          toast.error(t("errors.generic"));
          onClose();
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  useEffect(() => {
    if (!debouncedSearch.trim() || !canSearchUsers) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс подсказок
      setFound([]);
      return;
    }
    adminApi.users
      .list({ search: debouncedSearch.trim(), limit: 5 })
      .then((page) => setFound(page.items))
      .catch(() => {});
  }, [debouncedSearch, canSearchUsers]);

  async function grant(user: UserProfile) {
    if (!entity) return;
    setBusy(true);
    try {
      const updated = await legalEntitiesApi.grantAccess(entity.id, user.id);
      setEntity(updated);
      setUserSearch("");
      toast.success(t("accessGranted"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    if (!entity) return;
    setBusy(true);
    try {
      await legalEntitiesApi.revokeAccess(entity.id, userId);
      setEntity((prev) =>
        prev
          ? { ...prev, users: prev.users?.filter((u) => u.id !== userId) }
          : prev
      );
      toast.success(t("accessRevoked"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!entity) return;
    setBusy(true);
    try {
      await legalEntitiesApi.remove(entity.id);
      toast.success(t("deleted"));
      setConfirmDelete(false);
      onClose();
      onChanged();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!entityId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {!entity ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3 pr-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light">
                  <Building2 className="size-5 text-primary" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 break-words">{entity.name}</span>
              </SheetTitle>
              <SheetDescription className="tabular-nums">
                {t("taxId")}: {entity.taxId}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-6">
              <EntityRequisites entity={entity} />

              {canManage && (
                <>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                      className="gap-2"
                    >
                      <Pencil className="size-4" />
                      {t("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                      className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      {t("delete")}
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-3">
                    <Label className="text-sm font-medium text-muted-foreground">
                      {t("accessSection")}
                    </Label>

                    {(entity.users ?? []).length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {entity.users!.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-semibold text-primary">
                              {u.name.trim().charAt(0).toUpperCase()}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm font-medium">
                                {[u.name, u.lastName].filter(Boolean).join(" ")}
                              </span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {u.phone}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={busy}
                              aria-label={t("revoke")}
                              onClick={() => revoke(u.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("noAccessUsers")}
                      </p>
                    )}

                    {canSearchUsers && (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder={t("grantPlaceholder")}
                          className="pl-9"
                        />
                        {found.length > 0 && (
                          <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                            {found
                              .filter(
                                (u) => !entity.users?.some((x) => x.id === u.id)
                              )
                              .map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => grant(u)}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                                >
                                  <span>
                                    {[u.name, u.lastName].filter(Boolean).join(" ")}
                                  </span>
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {u.phone}
                                  </span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <EntityFormDialog
              open={editing}
              entity={entity}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                legalEntitiesApi.get(entity.id).then(setEntity).catch(() => {});
                onChanged();
              }}
            />

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("deleteConfirmTitle", { name: entity.name })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteConfirmText")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={remove}
                    disabled={busy}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    {t("delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
