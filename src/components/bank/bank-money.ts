/** Суммы банка приходят в тийинах — показываем в сумах */
export function formatTiyin(tiyin: number): string {
  const soums = tiyin / 100;
  return soums.toLocaleString("ru-RU", {
    minimumFractionDigits: soums % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Ввод человека в сумах → целые ТИЙИНЫ. Строковой арифметикой, без float:
 * «5 000 000» → 500000000, «1500,5» → 150050. Больше двух знаков после
 * запятой, буквы, пусто → null (дробных тийинов быть не может).
 */
export function parseSumToTiyin(input: string): number | null {
  const s = input.replace(/[\s  ]/g, "").replace(",", ".");
  const m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const whole = m[1].replace(/^0+(?=\d)/, "");
  const frac = (m[2] ?? "").padEnd(2, "0");
  const tiyin = Number(whole + frac);
  return Number.isSafeInteger(tiyin) ? tiyin : null;
}

/** Тийины → строка для поля ввода в сумах (без разделителей тысяч) */
export function tiyinToSumInput(tiyin: number): string {
  const sign = tiyin < 0 ? "-" : "";
  const abs = Math.abs(tiyin);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}${frac ? `.${String(frac).padStart(2, "0")}` : ""}`;
}

/** Ввод со знаком (входящий остаток может быть отрицательным, напр. овердрафт) */
export function parseSignedSumToTiyin(input: string): number | null {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-") || trimmed.startsWith("−");
  const value = parseSumToTiyin(negative ? trimmed.slice(1) : trimmed);
  if (value === null) return null;
  return negative ? -value : value;
}
