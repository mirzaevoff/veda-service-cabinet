import type { DevTaskPriority, DevTaskStatus } from "@/lib/api";

/** Порядок колонок канбан-доски */
export const STATUSES: DevTaskStatus[] = [
  "new",
  "accepted",
  "in_progress",
  "need_info",
  "done",
  "rejected",
];

/** Приоритеты по возрастанию значимости */
export const PRIORITIES: DevTaskPriority[] = ["low", "normal", "high", "urgent"];

/** Разрешённые переходы статусов (зеркало TRANSITIONS бэкенда) */
export const TRANSITIONS: Record<DevTaskStatus, DevTaskStatus[]> = {
  new: ["accepted", "in_progress", "need_info", "rejected"],
  accepted: ["in_progress", "need_info", "rejected"],
  in_progress: ["done", "need_info", "accepted", "rejected"],
  need_info: ["in_progress", "accepted", "rejected", "new"],
  done: ["in_progress"],
  rejected: ["in_progress", "accepted"],
};

/** Цвет бейджа статуса задачи (токены дизайн-системы) */
export function statusStyle(status: DevTaskStatus): string {
  switch (status) {
    case "new":
      return "bg-secondary text-muted-foreground";
    case "accepted":
      return "bg-accent-light text-primary";
    case "in_progress":
      return "bg-warning-light text-warning";
    case "need_info":
      return "bg-warning-light text-warning";
    case "done":
      return "bg-success-light text-success";
    case "rejected":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

/** Цвет бейджа приоритета */
export function priorityStyle(priority: DevTaskPriority): string {
  switch (priority) {
    case "low":
      return "bg-secondary text-muted-foreground";
    case "normal":
      return "bg-secondary text-foreground";
    case "high":
      return "bg-warning-light text-warning";
    case "urgent":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

/**
 * Разбор записи журнала вида `status:<from>-><to>`.
 * Возвращает `{from,to}` для статусных переходов, иначе `null`.
 */
export function parseStatusLog(
  action: string
): { from: DevTaskStatus; to: DevTaskStatus } | null {
  if (!action.startsWith("status:")) return null;
  const rest = action.slice("status:".length);
  const [from, to] = rest.split("->");
  if (!from || !to) return null;
  return { from: from as DevTaskStatus, to: to as DevTaskStatus };
}

/** ISO-дата или `YYYY-MM-DD` → `YYYY-MM-DD` для DatePicker/сравнений */
export function toDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

/**
 * Просрочена ли задача: плановый (или желаемый) срок в прошлом и задача
 * не закрыта (не done/rejected).
 */
export function isOverdue(
  due: string | null | undefined,
  status: DevTaskStatus
): boolean {
  if (!due) return false;
  if (status === "done" || status === "rejected") return false;
  const day = due.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return day < today;
}
