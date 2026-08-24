import type { LedgerEntry, LedgerType } from "@/lib/api";

export const LEDGER_TYPE_STYLES: Record<LedgerType, string> = {
  topup: "bg-success-light text-success",
  correction: "bg-accent-light text-primary",
  audit: "bg-secondary text-muted-foreground",
};

/** Знаковая сумма в сумах с валютой */
export function formatLedgerAmount(entry: LedgerEntry, locale: string) {
  const sign = entry.amountTiyin < 0 ? "−" : "+";
  const abs = Math.abs(entry.amountSum);
  const cur = entry.currency === "UZS" ? "сум" : entry.currency;
  return `${sign}${abs.toLocaleString(locale)} ${cur}`;
}
