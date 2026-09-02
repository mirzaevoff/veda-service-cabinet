import type { InventoryAuditStatus } from "@/lib/api";

export function auditStatusStyle(status: InventoryAuditStatus): string {
  switch (status) {
    case "approved":
      return "bg-success-light text-success";
    case "completed":
      return "bg-accent-light text-primary";
    default:
      return "bg-secondary text-muted-foreground";
  }
}
