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

/** Сетка реквизитов ЮЛ — используется в карточках и drawer */
export function EntityRequisites({ entity }: { entity: LegalEntity }) {
  const t = useTranslations("LegalEntities");
  const locale = useLocale();

  const rows: [string, string][] = [
    [t("establishment"), entity.establishment],
    [t("taxId"), entity.taxId],
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
