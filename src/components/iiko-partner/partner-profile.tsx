"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Award,
  Building2,
  CircleAlert,
  Mail,
  Phone,
  RefreshCw,
  Settings2,
  TrendingDown,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { ApiError, type IikoPartnerProfile } from "@/lib/api";
import { iikoPartnerApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { useDelayed } from "@/hooks/use-delayed";
import { cn } from "@/lib/utils";

/** Профиль партнёра iiko: компания + статус, метрики, менеджер */
export function PartnerProfile() {
  const t = useTranslations("IikoPartner");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();

  const [profile, setProfile] = useState<IikoPartnerProfile | null>(null);
  /** Код ошибки ER130x, из которого рисуем экран-заглушку */
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const showSkeleton = useDelayed(loading && !profile);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    try {
      const result = await iikoPartnerApi.profile(refresh);
      setProfile(result);
      setErrorCode(null);
      if (refresh) toast.success(t("refreshed"));
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        router.replace("/login");
      } else if (e instanceof ApiError) {
        if (refresh) toast.error(errorText(e.code));
        else setErrorCode(e.code);
      } else if (!refresh) {
        setErrorCode("network");
      } else {
        toast.error(t("errors.generic"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/router нестабильны
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState после await
    void load(false);
  }, [load]);

  function errorText(code: string) {
    return ["ER1300", "ER1301", "ER1302", "ER1303"].includes(code)
      ? t(`errors.${code}`)
      : t("errors.generic");
  }

  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-4">
      {profile && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="gap-2"
          >
            {refreshing ? (
              <Spinner className="size-4" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t("refresh")}
          </Button>
        </div>
      )}

      {loading && !profile ? (
        showSkeleton && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-44 rounded-lg animate-in fade-in duration-300" />
            <Skeleton className="h-44 rounded-lg animate-in fade-in duration-300" />
          </div>
        )
      ) : errorCode ? (
        /* Экран-заглушка: не настроено / портал недоступен / креды / парсер */
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <CircleAlert className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            {errorCode === "network" ? t("errors.generic") : errorText(errorCode)}
          </p>
          <div className="flex items-center gap-2">
            {errorCode !== "ER1302" && (
              <Button variant="outline" onClick={() => void load(false)} className="gap-2">
                <RefreshCw className="size-4" />
                {t("retry")}
              </Button>
            )}
            {["ER1301", "ER1302"].includes(errorCode) &&
              can(PERMISSIONS.settingsManage) && (
                <Link href="/admin/panel?tab=settings">
                  <Button className="gap-2">
                    <Settings2 className="size-4" />
                    {t("openSettings")}
                  </Button>
                </Link>
              )}
          </div>
        </div>
      ) : profile ? (
        <div className="flex flex-col gap-4">
          {profile.stale && (
            <div className="flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning-light px-4 py-3 text-sm text-warning duration-300 animate-in fade-in">
              <CircleAlert className="size-4 shrink-0" />
              {t("staleBanner", { time: formatTime(profile.fetchedAt) })}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Компания */}
            <section className="flex flex-col gap-4 rounded-lg border border-border p-5 duration-450 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light">
                  <Building2 className="size-4.5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="flex min-w-0 flex-col">
                  <h3 className="truncate font-semibold">{profile.company.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {t("companyCard")}
                  </span>
                </div>
              </div>

              {profile.company.addressLines.length > 0 && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {profile.company.addressLines.join(", ")}
                </p>
              )}

              <div className="flex flex-col gap-1.5 text-sm">
                {profile.company.phones.map((phone) => (
                  <span key={phone.number} className="flex items-center gap-2">
                    <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="tabular-nums">{phone.number}</span>
                    {phone.label && (
                      <span className="text-xs text-muted-foreground">
                        {phone.label}
                      </span>
                    )}
                  </span>
                ))}
                {profile.company.email && (
                  <a
                    href={`mailto:${profile.company.email}`}
                    className="flex items-center gap-2 transition-colors hover:text-primary"
                  >
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    {profile.company.email}
                  </a>
                )}
              </div>
            </section>

            {/* Статус партнёра */}
            <section className="flex flex-col gap-4 rounded-lg border border-border p-5 duration-450 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light">
                  <Award className="size-4.5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="flex min-w-0 flex-col">
                  <h3 className="truncate font-semibold">
                    {profile.partner.status}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {t("partnerCard")}
                  </span>
                </div>
                {profile.partner.discountPercent !== null && (
                  <Badge
                    variant="secondary"
                    className="ms-auto shrink-0 bg-accent-light text-primary tabular-nums"
                  >
                    {t("discount", { percent: profile.partner.discountPercent })}
                  </Badge>
                )}
              </div>

              <dl className="flex flex-col gap-1.5 text-sm">
                {profile.partner.masterPartner && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">{t("masterPartner")}</dt>
                    <dd className="font-medium">{profile.partner.masterPartner}</dd>
                  </div>
                )}
                {profile.partner.manager && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <UserRound className="size-3.5" />
                      {t("manager")}
                    </dt>
                    <dd className="text-right">
                      <span className="font-medium">
                        {profile.partner.manager.name}
                      </span>
                      {profile.partner.manager.email && (
                        <a
                          href={`mailto:${profile.partner.manager.email}`}
                          className="block text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                          {profile.partner.manager.email}
                        </a>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          </div>

          {/* Метрики года */}
          {profile.partner.metrics.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.partner.metrics.map((metric, i) => (
                <section
                  key={metric.label}
                  className="flex flex-col gap-1 rounded-lg border border-border p-5 duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
                  style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
                >
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {metric.label}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums">
                      {metric.value}
                    </span>
                    {metric.yoyPercent !== null && (
                      <span
                        className={cn(
                          "flex items-center gap-0.5 text-xs font-medium tabular-nums",
                          metric.trend === "down"
                            ? "text-destructive"
                            : "text-success"
                        )}
                      >
                        {metric.trend === "down" ? (
                          <TrendingDown className="size-3.5" />
                        ) : (
                          <TrendingUp className="size-3.5" />
                        )}
                        {metric.yoyPercent}%
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {metric.period}
                  </span>
                </section>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {t("fetchedAt", { time: formatTime(profile.fetchedAt) })}
            {profile.cached && ` · ${t("fromCache")}`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
