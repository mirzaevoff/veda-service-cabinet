/** Цвет бейджа статуса счёта (портал даёт произвольные строки) */
export function invoiceStatusStyle(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("paid")) return "bg-success-light text-success";
  if (s.includes("cancel")) return "bg-secondary text-muted-foreground";
  if (s.includes("overdue")) return "bg-destructive/10 text-destructive";
  return "bg-warning-light text-warning";
}

/** amountMinor (÷100) в формате валюты */
export function formatAmount(
  amountMinor: number,
  currency: string,
  locale: string
) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toLocaleString(locale)} ${currency}`;
  }
}
