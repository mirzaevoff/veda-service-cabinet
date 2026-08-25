/** Сумма в сумах (значение уже ÷100 с бэка) + «сум» */
export function formatSum(sum: number, locale: string): string {
  return `${sum.toLocaleString(locale, { maximumFractionDigits: 2 })} сум`;
}

/** Стиль бейджа статуса счёта */
export function invoiceStatusStyle(status: string): string {
  switch (status) {
    case "issued":
      return "bg-accent-light text-primary";
    case "paid":
      return "bg-success-light text-success";
    case "cancelled":
      return "bg-secondary text-muted-foreground";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

/** Скачать Blob как файл */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
