"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

export type StatusDialogMode = "reject" | "done";

/**
 * Диалог движения в rejected/done.
 * - reject: причина (resolution) обязательна.
 * - done: итог (resolution) и версия релиза (shippedVersion) — оба опциональны.
 */
export function DevTaskStatusDialog({
  mode,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  mode: StatusDialogMode | null;
  open: boolean;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: { resolution?: string; shippedVersion?: string }) => void;
}) {
  const t = useTranslations("DevTasks");
  const tc = useTranslations("Common");
  const [resolution, setResolution] = useState("");
  const [shippedVersion, setShippedVersion] = useState("");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс полей при каждом открытии диалога
      setResolution("");
      setShippedVersion("");
    }
  }, [open]);

  function submit() {
    if (mode === "reject" && !resolution.trim()) {
      toast.error(t("rejectReasonRequired"));
      return;
    }
    onConfirm({
      resolution: resolution.trim() || undefined,
      shippedVersion: mode === "done" ? shippedVersion.trim() || undefined : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "reject" ? t("rejectTitle") : t("doneTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {mode === "reject" ? t("rejectReason") : t("resolutionField")}
            </Label>
            <Textarea
              autoFocus
              rows={3}
              value={resolution}
              maxLength={2000}
              placeholder={
                mode === "reject" ? t("rejectReasonPlaceholder") : t("resolutionPlaceholder")
              }
              onChange={(e) => setResolution(e.target.value)}
            />
          </div>

          {mode === "done" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("shippedVersionField")}
              </Label>
              <Input
                value={shippedVersion}
                maxLength={50}
                placeholder="1.0.0"
                onChange={(e) => setShippedVersion(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? <Spinner className="size-4" /> : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
