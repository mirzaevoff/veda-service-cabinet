import type { ChainInvoiceStatus, ChainLineFlag } from "@/lib/api";

/** Центы USD × курс → тийины (сум = /100). tiyin = round(minor × rate) */
export function minorToTiyin(amountMinor: number, rate: number): number {
  return Math.round(amountMinor * rate);
}

export const CHAIN_STATUS_STYLES: Record<ChainInvoiceStatus, string> = {
  draft: "bg-secondary text-muted-foreground",
  issued: "bg-accent-light text-primary",
  paid: "bg-success-light text-success",
};

/** Флаги, которые блокируют выпуск (уводят в корзину) */
export const BLOCKING_FLAGS: ChainLineFlag[] = [
  "unmapped",
  "no-allocation",
  "unlinked",
  "no-co-entity",
];
