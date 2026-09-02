"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Department, InventoryAudit, Office } from "@/lib/api";
import { inventoryApi, locationsApi } from "@/lib/api-authed";

const ALL_DEPT = "__all__";

/** Создание акта инвентаризации (снимок оборудования локации) */
export function CreateAuditDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (audit: InventoryAudit) => void;
}) {
  const t = useTranslations("Inventory");
  const tc = useTranslations("Common");

  const [offices, setOffices] = useState<Office[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [officeId, setOfficeId] = useState("");
  const [departmentId, setDepartmentId] = useState(ALL_DEPT);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при открытии
    setOfficeId("");
    setDepartmentId(ALL_DEPT);
    setNote("");
    setDepartments([]);
    void locationsApi.offices().then(setOffices).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open || !officeId) return;
    let cancelled = false;
    void locationsApi
      .departments(officeId)
      .then((d) => !cancelled && setDepartments(d))
      .catch(() => !cancelled && setDepartments([]));
    return () => {
      cancelled = true;
    };
  }, [open, officeId]);

  async function create() {
    if (!officeId) {
      toast.error(t("officeRequired"));
      return;
    }
    setCreating(true);
    try {
      const audit = await inventoryApi.create({
        officeId,
        departmentId: departmentId === ALL_DEPT ? undefined : departmentId,
        note: note.trim() || undefined,
      });
      toast.success(t("created"));
      onCreated(audit);
      onClose();
    } catch {
      toast.error(t("genericError"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createHint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">{t("office")}</Label>
            <Select
              value={officeId}
              items={Object.fromEntries(offices.map((o) => [o.id, o.name]))}
              onValueChange={(v) => {
                setOfficeId(v ?? "");
                setDepartmentId(ALL_DEPT);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("officePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("departmentOptional")}
            </Label>
            <Select
              value={departmentId}
              items={{
                [ALL_DEPT]: t("wholeOffice"),
                ...Object.fromEntries(departments.map((d) => [d.id, d.name])),
              }}
              onValueChange={(v) => setDepartmentId(v ?? ALL_DEPT)}
              disabled={!officeId}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPT}>{t("wholeOffice")}</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">{t("note")}</Label>
            <textarea
              value={note}
              maxLength={2000}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={creating || !officeId} onClick={() => void create()}>
            {creating ? <Spinner className="size-4" /> : t("createAct")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
