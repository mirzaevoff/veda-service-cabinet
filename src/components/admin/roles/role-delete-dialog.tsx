"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { ApiError, type Role } from "@/lib/api";
import { adminApi } from "@/lib/api-authed";
import { logActivity } from "@/lib/activity-log";

export function RoleDeleteDialog({
  role,
  onClose,
  onDeleted,
}: {
  role: Role | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("AdminRoles");
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!role) return;
    setBusy(true);
    try {
      await adminApi.roles.remove(role.id);
      logActivity({
        type: "role.delete",
        category: "Роли и доступы",
        description: "Удаление роли",
        targetType: "role",
        targetId: role.id,
        meta: { slug: role.slug },
      });
      toast.success(t("deleted"));
      onDeleted();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER303") {
        const count = Number(e.data?.usersWithRole ?? 0);
        toast.error(t("errors.ER303", { count }));
      } else if (e instanceof ApiError && e.code === "ER302") {
        toast.error(t("errors.ER302delete"));
      } else {
        toast.error(t("errors.generic"));
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={!!role} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("deleteConfirmTitle", { name: role?.title.ru ?? role?.slug ?? "" })}
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
            {t("deleteAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
