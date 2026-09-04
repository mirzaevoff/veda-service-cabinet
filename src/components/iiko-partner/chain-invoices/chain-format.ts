/** Центы USD × курс → тийины (сум = /100). tiyin = round(minor × rate) */
export function minorToTiyin(amountMinor: number, rate: number): number {
  return Math.round(amountMinor * rate);
}
