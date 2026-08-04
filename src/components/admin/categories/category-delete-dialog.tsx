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
import { ApiError, type TicketCategory } from "@/lib/api";
import { adminApi } from "@/lib/api-authed";

export function CategoryDeleteDialog({
  category,
  onClose,
  onDeleted,
}: {
  category: TicketCategory | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("AdminCategories");
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!category) return;
    setBusy(true);
    try {
      await adminApi.categories.remove(category.id);
      toast.success(t("deletedToast"));
      onDeleted();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER404") {
        toast.error(
          t("errors.ER404", {
            children: Number(e.data?.children ?? 0),
            tickets: Number(e.data?.tickets ?? 0),
          })
        );
      } else {
        toast.error(t("errors.generic"));
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={!!category} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("deleteConfirmTitle", { name: category?.name.ru ?? "" })}
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
