"use client";

import { useLocale, useTranslations } from "next-intl";
import type { LegalEntity } from "@/lib/api";

export function directorName(
  director: LegalEntity["director"]
): string {
  if (!director) return "";
  return [director.lastName, director.firstName, director.middleName]
    .filter(Boolean)
    .join(" ");
}

/**
 * Заглавная первая буква каждого слова, остальное — строчными (имена приходят КАПСОМ).
 * Разделители — пробел и дефис; апостроф НЕ разделитель (в узбекском oʻ/gʻ это модификатор буквы,
 * «BO'RIYEVA» → «Bo'riyeva», а не «Bo'Riyeva»).
 */
function titleCase(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
}

/**
 * Короткое имя директора: фамилия с заглавной + инициалы.
 * «NEMATJONOV MURODJON XIKMATOVICH» → «Nematjonov M. X.»
 */
export function directorNameShort(
  director: LegalEntity["director"]
): string {
  if (!director) return "";
  const last = titleCase((director.lastName ?? "").trim());
  const initials = [director.firstName, director.middleName]
    .map((n) => (n ?? "").trim())
    .filter(Boolean)
    .map((n) => `${n[0].toLocaleUpperCase()}.`)
    .join(" ");
  return [last, initials].filter(Boolean).join(" ").trim();
}

/** Сетка реквизитов ЮЛ — используется в карточках и drawer */
export function EntityRequisites({ entity }: { entity: LegalEntity }) {
  const t = useTranslations("LegalEntities");
  const locale = useLocale();

  const rows: [string, string][] = [
    [t("taxId"), entity.taxId],
    [t("pinfl"), entity.pinfl],
    [
      t("bank"),
      [entity.bank, entity.bankCode, entity.bankAccount]
        .filter(Boolean)
        .join(" · "),
    ],
    [t("address"), entity.address],
    [t("director"), directorName(entity.director)],
    [
      t("registrationDate"),
      entity.registrationDate
        ? new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date(`${entity.registrationDate}T00:00:00`))
        : "",
    ],
  ];

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words tabular-nums">{value}</dd>
          </div>
        ))}
    </dl>
  );
}
