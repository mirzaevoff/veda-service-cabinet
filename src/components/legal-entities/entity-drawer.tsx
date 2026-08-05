"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Pencil, Trash2 } from "lucide-react";
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
import { MembersManager } from "./members-manager";
import type { LegalEntity } from "@/lib/api";
import { legalEntitiesApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";

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

  const [entity, setEntity] = useState<LegalEntity | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при смене ЮЛ
    setEntity(null);
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
                {entity.establishment && `${entity.establishment} · `}
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

                  <MembersManager
                    entityId={entity.id}
                    members={entity.members ?? []}
                    onChanged={() => {
                      legalEntitiesApi
                        .get(entity.id)
                        .then(setEntity)
                        .catch(() => {});
                    }}
                  />
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
