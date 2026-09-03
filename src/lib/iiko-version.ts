import type { IikoVersionStatus } from "./api";

/** Цвета плашки версии по свежести (см. VENUE_STATUS_STYLES) */
export const VERSION_STATUS_STYLES: Record<IikoVersionStatus, string> = {
  current: "bg-success-light text-success",
  outdated: "bg-warning-light text-warning",
  critical: "bg-destructive/10 text-destructive",
  unknown: "bg-secondary text-muted-foreground",
};
