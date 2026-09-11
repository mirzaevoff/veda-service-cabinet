import type { DocumentStatus } from "@/lib/api";

/** Цвет бейджа статуса документа: действует — зелёный, на согласовании — жёлтый */
export function documentStatusStyle(status: DocumentStatus): string {
  switch (status) {
    case "active":
      return "bg-success-light text-success";
    case "pending":
      return "bg-warning-light text-warning";
    case "archived":
      return "bg-secondary text-muted-foreground";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

/** Ключ i18n действия журнала (Documents.log.*) с фолбэком на сырое значение */
export function logActionKey(action: string): string {
  const known = [
    "created",
    "edited",
    "submitted",
    "confirmed",
    "activated",
    "acknowledged",
    "archived",
    "confirmations-reset",
  ];
  return known.includes(action) ? action : "unknown";
}
