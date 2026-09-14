"use client";

import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DevTaskListItem, DevTaskType } from "@/lib/api";
import { formatDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { DevTaskTypeBadge } from "./dev-task-type-badge";
import { isOverdue, priorityStyle } from "./dev-tasks-format";

export function DevTaskCard({
  task,
  types,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  task: DevTaskListItem;
  types: Map<string, DevTaskType>;
  draggable?: boolean;
  onDragStart?: (task: DevTaskListItem) => void;
  onDragEnd?: () => void;
}) {
  const t = useTranslations("DevTasks");
  const locale = useLocale();
  const router = useRouter();

  const due = task.plannedDueDate ?? task.desiredDueDate;
  const dueOverdue = isOverdue(due, task.status);
  const dueLabelKey = task.plannedDueDate ? "plannedBy" : "desiredBy";

  function open() {
    router.push(`/dev-tasks/${task.id}`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(task);
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40",
        draggable && "active:cursor-grabbing"
      )}
    >
      <span className="line-clamp-3 text-sm font-medium">{task.title}</span>

      <div className="flex flex-wrap items-center gap-1.5">
        <DevTaskTypeBadge slug={task.type} types={types} />
        <Badge variant="secondary" className={priorityStyle(task.priority)}>
          {t(`priority.${task.priority}`)}
        </Badge>
        {task.area && (
          <span className="text-xs text-muted-foreground">{task.area}</span>
        )}
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((x) => (
            <span
              key={x}
              className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              #{x}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="size-3.5 shrink-0" />
          {task.assignee ? task.assignee.name : t("noAssignee")}
        </span>
        {due && (
          <span
            className={cn(
              "flex items-center gap-1",
              dueOverdue && "text-destructive"
            )}
          >
            <CalendarClock className="size-3.5 shrink-0" />
            {dueOverdue
              ? t("overdue")
              : t(dueLabelKey, { date: formatDateOnly(due.slice(0, 10), locale) })}
          </span>
        )}
      </div>
    </div>
  );
}
