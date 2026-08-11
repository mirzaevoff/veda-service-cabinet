/** Суммы банка приходят в тийинах — показываем в сумах */
export function formatTiyin(tiyin: number): string {
  const soums = tiyin / 100;
  return soums.toLocaleString("ru-RU", {
    minimumFractionDigits: soums % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
