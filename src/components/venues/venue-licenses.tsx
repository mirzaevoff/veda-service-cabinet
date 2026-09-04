"use client";

import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck, CalendarClock, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Venue } from "@/lib/api";
import { cn } from "@/lib/utils";

/** «30 сент. 2026» из ISO (или «—») */
function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

/** Лицензии / подписки / сервисный интервал заведения (chain-invoices, Этап 0b) */
export function VenueLicenses({ venue }: { venue: Venue }) {
  const t = useTranslations("Venues");
  const locale = useLocale();

  const hasLicenses = venue.licenses.length > 0;
  const hasSubs = venue.subscriptions.length > 0;
  const hasInterval = !!venue.serviceInterval;
  if (!hasLicenses && !hasSubs && !hasInterval) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {hasLicenses && (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
              <KeyRound className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("licensesTitle")}
            </h4>
          </div>
          <div className="flex flex-col gap-2">
            {venue.licenses.map((lic, i) => {
              const days = daysUntil(lic.to);
              const expired = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days <= 30;
              return (
                <div key={i} className="flex flex-col gap-0.5 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 break-words font-medium">{lic.product}</span>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      ×{lic.quantity}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
                    <span>
                      {fmtDate(lic.from, locale)} — {fmtDate(lic.to, locale)}
                    </span>
                    {expired && (
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                        {t("licenseExpired")}
                      </Badge>
                    )}
                    {soon && (
                      <Badge variant="secondary" className="bg-warning-light text-warning">
                        {t("licenseExpiresIn", { days })}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hasSubs && (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
              <BadgeCheck className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("subscriptionsTitle")}
            </h4>
          </div>
          <div className="flex flex-col gap-2">
            {venue.subscriptions.map((sub, i) => (
              <div key={i} className="flex flex-col gap-0.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 uppercase",
                      sub.kind === "cloud" ? "bg-accent-light text-primary" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {sub.kind}
                  </Badge>
                  <span className="min-w-0 break-words font-medium tabular-nums">{sub.number}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {sub.period && `${sub.period} · `}
                  {t("subUntil", { date: fmtDate(sub.to, locale) })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasInterval && venue.serviceInterval && (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
              <CalendarClock className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("serviceIntervalTitle")}
            </h4>
          </div>
          <p className="text-sm font-medium tabular-nums">
            {venue.serviceInterval.from.slice(0, 5)} — {venue.serviceInterval.to.slice(0, 5)}
            <span className="ms-1.5 text-xs font-normal text-muted-foreground">
              ({venue.serviceInterval.timezone})
            </span>
          </p>
        </section>
      )}
    </div>
  );
}
