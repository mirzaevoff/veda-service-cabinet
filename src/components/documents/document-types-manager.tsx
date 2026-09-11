"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, type DocumentType } from "@/lib/api";
import { documentsApi, SessionExpiredError } from "@/lib/api-authed";
import { useRouter } from "@/i18n/navigation";
import { DocumentTypeBadge } from "./document-type-badge";

export function DocumentTypesManager({ onChange }: { onChange?: () => void }) {
  const t = useTranslations("Documents");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<DocumentType[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Форма добавления/редактирования
  const [formOpen, setFormOpen] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [minConf, setMinConf] = useState("2");
  const [color, setColor] = useState("");

  const load = useCallback(() => {
    documentsApi
      .types()
      .then(setTypes)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    setFormOpen(false);
    if (next) load();
  }

  function openNew() {
    setFormId(null);
    setName("");
    setMinConf("2");
    setColor("");
    setFormOpen(true);
  }

  function openEdit(type: DocumentType) {
    setFormId(type.id);
    setName(type.name);
    setMinConf(String(type.minConfirmations));
    setColor(type.color ?? "");
    setFormOpen(true);
  }

  async function saveType() {
    if (!name.trim()) {
      toast.error(t("typeName"));
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        minConfirmations: Math.max(0, Number(minConf) || 0),
        color: color.trim() || undefined,
      };
      if (formId) await documentsApi.updateType(formId, body);
      else await documentsApi.createType(body);
      toast.success(t("typeSaved"));
      setFormOpen(false);
      load();
      onChange?.();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteType(id: string) {
    try {
      await documentsApi.removeType(id);
      toast.success(t("typeDeleted"));
      load();
      onChange?.();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (e instanceof ApiError && e.code === "ER2303") toast.error(t("typeInUse"));
      else toast.error(t("genericError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2">
            <Settings2 className="size-4" />
            {t("typesButton")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("typesTitle")}</DialogTitle>
          <DialogDescription>{t("typesHint")}</DialogDescription>
        </DialogHeader>

        {!types ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : types.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noTypes")}</p>
        ) : (
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {types.map((type) => (
              <div
                key={type.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DocumentTypeBadge type={type} />
                    {type.system && (
                      <Badge variant="secondary" className="bg-secondary text-muted-foreground">
                        {t("systemType")}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("minConfirmations")}: {type.minConfirmations}
                  </span>
                </div>
                <div className="ms-auto flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("editType")}
                    onClick={() => openEdit(type)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {!type.system && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("deleteType")}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDeleteId(type.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {formOpen ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <span className="text-sm font-medium">{formId ? t("editType") : t("addType")}</span>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("typeName")}</Label>
              <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("minConfirmations")}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={minConf}
                  onChange={(e) => setMinConf(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-muted-foreground">#</Label>
                <Input
                  value={color}
                  placeholder="#A21500"
                  maxLength={9}
                  onChange={(e) => setColor(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void saveType()}>
                {busy ? <Spinner className="size-4" /> : tc("save")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={openNew}>
            <Plus className="size-4" />
            {t("addType")}
          </Button>
        )}
      </DialogContent>

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(v) => !v && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteType")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteTypeConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId) void deleteType(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
