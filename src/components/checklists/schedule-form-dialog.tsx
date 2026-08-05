"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
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
import type {
  ChecklistSchedule,
  ChecklistTemplate,
  LegalEntityMember,
  Position,
} from "@/lib/api";
import { ApiError } from "@/lib/api";
import { checklistsApi } from "@/lib/api-authed";
import { fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function ScheduleFormDialog({
  open,
  schedule,
  entityId,
  templates,
  positions,
  members,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null — создание */
  schedule: ChecklistSchedule | null;
  /** null — личные */
  entityId: string | null;
  templates: ChecklistTemplate[];
  positions: Position[];
  members: LegalEntityMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Checklists.scheduleForm");
  const td = useTranslations("Checklists.days");

  const [templateId, setTemplateId] = useState("");
  const [days, setDays] = useState<Set<number>>(new Set());
  const [times, setTimes] = useState<string[]>(["09:00"]);
  const [windowMinutes, setWindowMinutes] = useState("60");
  const [allowLate, setAllowLate] = useState(true);
  const [assigneePositions, setAssigneePositions] = useState<Set<string>>(new Set());
  const [assigneeUsers, setAssigneeUsers] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс формы при открытии
      setTemplateId(schedule?.templateId ?? templates[0]?.id ?? "");
      setDays(new Set(schedule?.daysOfWeek ?? [1, 2, 3, 4, 5]));
      setTimes(schedule?.times ?? ["09:00"]);
      setWindowMinutes(String(schedule?.windowMinutes ?? 60));
      setAllowLate(schedule?.allowLateCompletion ?? true);
      setAssigneePositions(new Set(schedule?.assigneePositions ?? []));
      setAssigneeUsers(new Set(schedule?.assigneeUsers ?? []));
      setError(null);
    }
  }, [open, schedule, templates]);

  function toggle<T>(set: Set<T>, value: T, apply: (next: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  }

  async function save() {
    const cleanTimes = [...new Set(times.map((v) => v.trim()).filter(Boolean))];
    const win = Number(windowMinutes);
    if (
      !templateId ||
      days.size === 0 ||
      cleanTimes.length === 0 ||
      cleanTimes.some((v) => !TIME_RE.test(v)) ||
      !Number.isInteger(win) ||
      win < 5
    ) {
      setError(t("validation"));
      return;
    }
    if (entityId && assigneePositions.size === 0 && assigneeUsers.size === 0) {
      setError(t("noAssignees"));
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      daysOfWeek: [...days].sort(),
      times: cleanTimes,
      windowMinutes: win,
      allowLateCompletion: allowLate,
      ...(entityId
        ? {
            assigneePositions: [...assigneePositions],
            assigneeUsers: [...assigneeUsers],
          }
        : {}),
    };
    try {
      if (schedule) {
        await checklistsApi.schedules.update(schedule.id, body);
      } else {
        await checklistsApi.schedules.create({ templateId, ...body });
      }
      toast.success(t("saved"));
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER905") setError(t("noAssignees"));
      else if (e instanceof ApiError && e.code === "ER903")
        setError(t("templateArchived"));
      else setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{schedule ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!schedule && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("template")}
              </Label>
              <Select
                value={templateId}
                items={Object.fromEntries(templates.map((tpl) => [tpl.id, tpl.name]))}
                onValueChange={(v) => setTemplateId(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("daysLabel")}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggle(days, day, setDays)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    days.has(day)
                      ? "border-primary bg-accent-light text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {td(String(day))}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("timesLabel")}
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              {times.map((time, index) => (
                <div key={index} className="flex items-center gap-1">
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) =>
                      setTimes((prev) =>
                        prev.map((v, i) => (i === index ? e.target.value : v))
                      )
                    }
                    className="w-28 tabular-nums"
                  />
                  {times.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("removeTime")}
                      onClick={() =>
                        setTimes((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {times.length < 12 && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("addTime")}
                  onClick={() => setTimes((prev) => [...prev, "12:00"])}
                >
                  <Plus className="size-4" />
                </Button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{t("timesHint")}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cs-window" className="text-sm font-medium text-muted-foreground">
              {t("windowLabel")}
            </Label>
            <Input
              id="cs-window"
              type="number"
              inputMode="numeric"
              min={5}
              max={1440}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(e.target.value)}
              className="w-28 tabular-nums"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={allowLate}
              onCheckedChange={(v) => setAllowLate(v === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="text-sm">{t("allowLateLabel")}</span>
              <span className="text-xs text-muted-foreground">
                {t("allowLateHint")}
              </span>
            </span>
          </label>

          {entityId && (
            <>
              {positions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("positionsLabel")}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {positions.map((position) => (
                      <button
                        key={position.id}
                        type="button"
                        onClick={() =>
                          toggle(assigneePositions, position.id, setAssigneePositions)
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition-colors",
                          assigneePositions.has(position.id)
                            ? "border-primary bg-accent-light text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {position.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("usersLabel")}
                </Label>
                <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
                  {members.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm"
                    >
                      <Checkbox
                        checked={assigneeUsers.has(member.id)}
                        onCheckedChange={() =>
                          toggle(assigneeUsers, member.id, setAssigneeUsers)
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{fullName(member)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {member.phone}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

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
