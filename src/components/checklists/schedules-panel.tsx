"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ScheduleFormDialog } from "./schedule-form-dialog";
import type {
  ChecklistSchedule,
  ChecklistTemplate,
  LegalEntityMember,
  Position,
} from "@/lib/api";
import { checklistsApi } from "@/lib/api-authed";
import { formatRelativeTime, fullName } from "@/lib/format";

/** Расписания скоупа (owner/ТП или личные) */
export function SchedulesPanel({
  entityId,
  templates,
  positions,
  members,
}: {
  /** null — личные */
  entityId: string | null;
  templates: ChecklistTemplate[];
  positions: Position[];
  members: LegalEntityMember[];
}) {
  const t = useTranslations("Checklists");
  const td = useTranslations("Checklists.days");
  const locale = useLocale();

  const [schedules, setSchedules] = useState<ChecklistSchedule[] | null>(null);
  const [editing, setEditing] = useState<ChecklistSchedule | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => {
    checklistsApi.schedules
      .list({ entity: entityId ?? undefined, limit: 50, sort: "nextRunAt:asc" })
      .then((page) => setSchedules(page.items))
      .catch(() => setSchedules([]));
  }, [entityId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при смене скоупа
    setSchedules(null);
    reload();
  }, [reload]);

  function templateName(id: string) {
    return templates.find((tpl) => tpl.id === id)?.name ?? t("unknownTemplate");
  }

  function describeAssignees(schedule: ChecklistSchedule) {
    const parts: string[] = [];
    for (const positionId of schedule.assigneePositions) {
      const position = positions.find((p) => p.id === positionId);
      if (position) parts.push(position.title);
    }
    for (const userId of schedule.assigneeUsers) {
      const member = members.find((m) => m.id === userId);
      if (member) parts.push(fullName(member));
    }
    return parts.join(", ");
  }

  async function toggleEnabled(schedule: ChecklistSchedule, enabled: boolean) {
    setSchedules((prev) =>
      prev?.map((s) => (s.id === schedule.id ? { ...s, enabled } : s)) ?? prev
    );
    try {
      await checklistsApi.schedules.update(schedule.id, { enabled });
    } catch {
      toast.error(t("errors.generic"));
      reload();
    }
  }

  async function remove(schedule: ChecklistSchedule) {
    try {
      await checklistsApi.schedules.remove(schedule.id);
      toast.success(t("scheduleDeleted"));
      reload();
    } catch {
      toast.error(t("errors.generic"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        onClick={() => setCreating(true)}
        disabled={templates.length === 0}
        className="gap-2 self-start"
      >
        <Plus className="size-4" />
        {t("newSchedule")}
      </Button>
      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("schedulesNeedTemplate")}</p>
      )}

      {!schedules ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : schedules.length === 0 ? (
        templates.length > 0 && (
          <div className="flex flex-col items-center gap-4 py-12 text-center duration-450 animate-in fade-in">
            <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
              <CalendarClock className="size-[26px] text-primary" strokeWidth={1.75} />
            </div>
            <p className="text-sm text-muted-foreground">{t("schedulesEmpty")}</p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {schedules.map((schedule, i) => (
            <div
              key={schedule.id}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
              style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {templateName(schedule.templateId)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[...schedule.daysOfWeek]
                    .sort()
                    .map((d) => td(String(d)))
                    .join(", ")}{" "}
                  · {schedule.times.join(", ")} ·{" "}
                  {t("windowShort", { minutes: schedule.windowMinutes })}
                </span>
                {entityId && (
                  <span className="truncate text-xs text-muted-foreground">
                    {describeAssignees(schedule)}
                  </span>
                )}
                {schedule.enabled && (
                  <span className="text-xs text-muted-foreground">
                    {t("nextRun", {
                      time: formatRelativeTime(schedule.nextRunAt, locale),
                    })}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Switch
                  checked={schedule.enabled}
                  onCheckedChange={(v) => toggleEnabled(schedule, v)}
                  aria-label={t("enabled")}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("scheduleForm.editTitle")}
                  onClick={() => setEditing(schedule)}
                  className="text-muted-foreground"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteSchedule")}
                  onClick={() => remove(schedule)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ScheduleFormDialog
        open={creating || !!editing}
        schedule={editing}
        entityId={entityId}
        templates={templates}
        positions={positions}
        members={members}
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
    </div>
  );
}
