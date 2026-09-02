import type { ActivityLogEvent } from "./api";
import { activityLogsApi } from "./api-authed";

/**
 * Клиентский логгер действий (POST /activity-logs).
 * Копит события в очередь и шлёт батчами — не блокирует UX, ошибки глушатся
 * (журнал не должен ломать интерфейс). Известный `type` из реестра на сервере
 * сам заполнит category/description, если их не передать.
 */

const MAX_BATCH = 100;
const FLUSH_DELAY_MS = 800;

let queue: ActivityLogEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  void activityLogsApi.write(batch).catch(() => {});
  if (queue.length > 0) schedule();
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, FLUSH_DELAY_MS);
}

/** Записать действие пользователя (fire-and-forget) */
export function logActivity(event: ActivityLogEvent) {
  if (typeof window === "undefined") return;
  queue.push(event);
  if (queue.length >= MAX_BATCH) flush();
  else schedule();
}
