"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateFormDialog } from "./template-form-dialog";
import type { ChecklistTemplate } from "@/lib/api";
import { checklistsApi } from "@/lib/api-authed";

/** Шаблоны выбранного скоупа. manage=false — только просмотр (член ЮЛ) */
export function TemplatesPanel({
  entityId,
  manage,
}: {
  /** null — личные */
  entityId: string | null;
  manage: boolean;
}) {
  const t = useTranslations("Checklists");
  const [templates, setTemplates] = useState<ChecklistTemplate[] | null>(null);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<ChecklistTemplate | null>(null);

  const reload = useCallback(() => {
    checklistsApi.templates
      .list({ entity: entityId ?? undefined, limit: 50 })
      .then((page) => setTemplates(page.items.filter((tpl) => !tpl.archived)))
      .catch(() => setTemplates([]));
  }, [entityId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при смене скоупа
    setTemplates(null);
    reload();
  }, [reload]);

  async function archive() {
    if (!archiving) return;
    try {
      await checklistsApi.templates.archive(archiving.id);
      toast.success(t("templateArchived"));
      setArchiving(null);
      reload();
    } catch {
      toast.error(t("errors.generic"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {manage && (
        <Button onClick={() => setCreating(true)} className="gap-2 self-start">
          <Plus className="size-4" />
          {t("newTemplate")}
        </Button>
      )}

      {!templates ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <FileText className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("templatesEmpty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((template, i) => (
            <div
              key={template.id}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
              style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light">
                <FileText className="size-4.5 text-primary" strokeWidth={1.75} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{template.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t("itemsCount", { count: template.items.length })}
                  {template.description && ` · ${template.description}`}
                  {` · v${template.version}`}
                </span>
              </div>
              {manage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("templateForm.editTitle")}
                    onClick={() => setEditing(template)}
                    className="text-muted-foreground"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("archive")}
                    onClick={() => setArchiving(template)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <TemplateFormDialog
        open={creating || !!editing}
        template={editing}
        entityId={entityId}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          reload();
        }}
      />

      <AlertDialog open={!!archiving} onOpenChange={(v) => !v && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("archiveConfirmTitle", { name: archiving?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("archiveConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={archive}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
