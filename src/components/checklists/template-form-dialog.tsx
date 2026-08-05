"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Camera, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { ChecklistItemType, ChecklistTemplate } from "@/lib/api";
import { checklistsApi } from "@/lib/api-authed";

interface ItemDraft {
  /** id существующего пункта — сохраняет связь с историей прохождений */
  id?: string;
  type: ChecklistItemType;
  title: string;
  required: boolean;
  requirePhoto: boolean;
}

const ITEM_TYPES: ChecklistItemType[] = [
  "checkbox",
  "text",
  "number",
  "scale",
  "photo",
];

export function TemplateFormDialog({
  open,
  template,
  entityId,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null — создание */
  template: ChecklistTemplate | null;
  /** null — личный чеклист */
  entityId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Checklists.templateForm");
  const tt = useTranslations("Checklists.itemTypes");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс формы при открытии
      setName(template?.name ?? "");
      setDescription(template?.description ?? "");
      setItems(
        template
          ? template.items.map((item) => ({ ...item }))
          : [{ type: "checkbox", title: "", required: false, requirePhoto: false }]
      );
      setError(null);
    }
  }, [open, template]);

  function patchItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function move(index: number, delta: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    const clean = items
      .map((item) => ({ ...item, title: item.title.trim() }))
      .filter((item) => item.title);
    if (!name.trim() || clean.length === 0) {
      setError(t("validation"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (template) {
        await checklistsApi.templates.update(template.id, {
          name: name.trim(),
          description: description.trim(),
          items: clean,
        });
      } else {
        await checklistsApi.templates.create({
          ...(entityId ? { entityId } : {}),
          name: name.trim(),
          description: description.trim() || undefined,
          items: clean,
        });
      }
      toast.success(t("saved"));
      onSaved();
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {entityId ? t("entityHint") : t("personalHint")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-name" className="text-sm font-medium text-muted-foreground">
              {t("name")}
            </Label>
            <Input
              id="ct-name"
              value={name}
              maxLength={200}
              placeholder={t("namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-desc" className="text-sm font-medium text-muted-foreground">
              {t("description")}
            </Label>
            <Input
              id="ct-desc"
              value={description}
              maxLength={500}
              placeholder={t("descriptionPlaceholder")}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("items")}
            </Label>
            {items.map((item, index) => (
              <div
                key={item.id ?? `new-${index}`}
                className="flex flex-col gap-2.5 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <Select
                    value={item.type}
                    items={Object.fromEntries(ITEM_TYPES.map((v) => [v, tt(v)]))}
                    onValueChange={(v) =>
                      patchItem(index, { type: v as ChecklistItemType })
                    }
                  >
                    <SelectTrigger className="w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {tt(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={item.title}
                    maxLength={500}
                    placeholder={t("itemTitlePlaceholder")}
                    onChange={(e) => patchItem(index, { title: e.target.value })}
                    className="min-w-0 flex-1"
                  />
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("moveUp")}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="text-muted-foreground"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("moveDown")}
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                      className="text-muted-foreground"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("removeItem")}
                      onClick={() =>
                        setItems((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={item.required}
                      onCheckedChange={(v) =>
                        patchItem(index, { required: v === true })
                      }
                    />
                    {t("required")}
                  </label>
                  {item.type !== "photo" && (
                    <label className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={item.requirePhoto}
                        onCheckedChange={(v) =>
                          patchItem(index, { requirePhoto: v === true })
                        }
                      />
                      <span className="flex items-center gap-1">
                        <Camera className="size-3.5" />
                        {t("requirePhoto")}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { type: "checkbox", title: "", required: false, requirePhoto: false },
                ])
              }
              className="gap-2 self-start"
            >
              <Plus className="size-4" />
              {t("addItem")}
            </Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

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
