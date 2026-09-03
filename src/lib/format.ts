import type { LocalizedString } from "./api";

/** «Имя Фамилия» (фамилия опциональна) */
export function fullName(user: { name: string; lastName?: string }): string {
  return [user.name, user.lastName].filter(Boolean).join(" ");
}

/** Длительность из минут: «—» / «N мин» / «Hч Mмин» / «Hч» */
export function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const total = Math.round(value);
  if (total < 60) return `${total} мин`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** Тийины → «12 345 сум» (÷100) */
export function formatTiyin(tiyin: number, locale: string): string {
  return `${Math.round(tiyin / 100).toLocaleString(locale)} сум`;
}

/** Минорные единицы валюты счёта → «$1 234.50» / «1 234.50 ₽» (÷100) */
export function formatMinor(
  amountMinor: number,
  currency: "USD" | "RUB",
  locale: string
): string {
  const amount = (amountMinor / 100).toLocaleString(locale, {
    maximumFractionDigits: 2,
  });
  return currency === "USD" ? `$${amount}` : `${amount} ₽`;
}

/** Выбор перевода локализованной строки API (фолбэк на ru) */
export function pickLocalized(
  value: LocalizedString | null | undefined,
  locale: string
): string {
  if (!value) return "";
  return value[locale as keyof LocalizedString] || value.ru || "";
}

/** «5 мин назад» / «вчера» — для списков; старше недели — дата */
export function formatRelativeTime(iso: string, locale: string): string {
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.trunc(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.trunc(diffSec / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.trunc(diffSec / 86400), "day");

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

/** Время для сообщений чата: HH:MM */
export function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Дата-разделитель в чате */
export function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year:
      new Date(iso).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  }).format(new Date(iso));
}
