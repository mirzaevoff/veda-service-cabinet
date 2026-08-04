import type { LocalizedString } from "./api";

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
