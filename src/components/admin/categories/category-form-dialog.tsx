"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { adminApi } from "@/lib/api-authed";
import type { CategoryEditState } from "./category-tree";

const LOCALES = ["ru", "uz", "en"] as const;

export function CategoryFormDialog({
  state,
  onClose,
  onSaved,
}: {
  state: CategoryEditState | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("AdminCategories");
  const [names, setNames] = useState({ ru: "", uz: "", en: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс формы при открытии
    setNames(
      state?.mode === "rename" && state.category
        ? { ...state.category.name }
        : { ru: "", uz: "", en: "" }
    );
    setError(null);
  }, [state]);

  if (!state) return null;

  const title =
    state.mode === "rename"
      ? t("rename")
      : state.mode === "create-child"
        ? t("createSubcategoryIn", { parent: state.parent?.name.ru ?? "" })
        : t("createCategory");

  async function save() {
    if (!names.ru.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const name = {
      ru: names.ru.trim(),
      uz: names.uz.trim() || undefined,
      en: names.en.trim() || undefined,
    };
    try {
      if (state!.mode === "rename" && state!.category) {
        await adminApi.categories.update(state!.category.id, { name });
      } else {
        await adminApi.categories.create({
          name,
          parentId: state!.mode === "create-child" ? state!.parent?.id : undefined,
        });
      }
      toast.success(t("saved"));
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER406") setError(t("errors.ER406"));
      else setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("formHintLocalized")}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {LOCALES.map((code) => (
            <div key={code} className="flex flex-col gap-1.5">
              <Label
                htmlFor={`category-name-${code}`}
                className="text-sm font-medium text-muted-foreground"
              >
                {t(`nameLabel_${code}`)}
              </Label>
              <Input
                id={`category-name-${code}`}
                autoFocus={code === "ru"}
                maxLength={100}
                value={names[code]}
                placeholder={code !== "ru" ? names.ru : undefined}
                onChange={(e) => {
                  setNames((prev) => ({ ...prev, [code]: e.target.value }));
                  setError(null);
                }}
              />
            </div>
          ))}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
