"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Check, LogIn, LogOut, MapPin, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, type MarkResult, type WorktimeToday } from "@/lib/api";
import { SessionExpiredError, worktimeApi } from "@/lib/api-authed";
import { formatMinutes, formatTashkentTime } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";

/**
 * Геолокация браузера. null — доступа нет или не получилось: отметку всё равно
 * отправляем, сервер пометит её как «вне зоны» (по ТЗ не блокируем).
 */
function requestGeo(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  });
}

/** Главный ежедневный экран сотрудника: одна большая кнопка «Пришёл»/«Ушёл» */
export function MarkAttendance() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [today, setToday] = useState<WorktimeToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [geoPending, setGeoPending] = useState(false);
  /** Мягкое предупреждение «вне рабочей зоны» (не блокирует) */
  const [outOfZone, setOutOfZone] = useState<{ distance: number | null } | null>(
    null
  );
  const [notEmployed, setNotEmployed] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [justMarked, setJustMarked] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const state = await worktimeApi.today();
      setToday(state);
      setNotEmployed(false);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        router.replace("/login");
        return;
      }
      if (e instanceof ApiError && e.code === "ER2403") {
        setNotEmployed(true);
        return;
      }
      if (!silent) toast.error(tc("loadError"));
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/tc нестабильны
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка
    void load();
  }, [load]);

  const firstIn = today?.firstIn ?? null;
  const onShift = Boolean(firstIn) && !today?.lastOut;
  const closed = Boolean(firstIn) && Boolean(today?.lastOut);

  function applyResult(result: MarkResult, type: "in" | "out") {
    const now = new Date().toISOString();
    setToday((prev) => ({
      date: prev?.date ?? now.slice(0, 10),
      status: result.day.status,
      firstIn: type === "in" ? (prev?.firstIn ?? now) : (prev?.firstIn ?? null),
      lastOut: type === "out" ? now : null,
      workedMinutes: result.day.workedMinutes,
      flagged: result.day.flagged,
    }));

    if (!result.mark.withinGeofence) {
      setOutOfZone({ distance: result.mark.distanceMeters ?? null });
    }

    setJustMarked(true);
    window.setTimeout(() => setJustMarked(false), 2200);
    toast.success(type === "in" ? t("markedIn") : t("markedOut"));
    setQrToken("");
    setQrMode(false);
    // Сверяем точное время прихода/ухода с сервером, без скелетона
    void load(true);
  }

  async function mark() {
    const type: "in" | "out" = onShift ? "out" : "in";
    setMarking(true);
    setOutOfZone(null);
    try {
      let geo: { lat: number; lng: number; accuracy?: number } | undefined;
      if (!qrMode) {
        setGeoPending(true);
        const position = await requestGeo();
        setGeoPending(false);
        if (position) {
          geo = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
          };
        }
      }

      const result = await worktimeApi.mark({
        type,
        geo,
        qrToken: qrMode ? qrToken.trim() || undefined : undefined,
      });
      applyResult(result, type);
    } catch (e) {
      setGeoPending(false);
      if (e instanceof SessionExpiredError) {
        router.replace("/login");
        return;
      }
      if (e instanceof ApiError && e.code === "ER2403") {
        setNotEmployed(true);
        return;
      }
      toast.error(t("markError"));
    } finally {
      setMarking(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;

  // Нет активного трудоустройства — отмечаться нечем
  if (notEmployed) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-lg bg-accent-light">
            <AlertTriangle className="size-6 text-primary" />
          </span>
          <p className="font-medium">{t("notEmployedTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("notEmployedHint")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-8 text-center">
          {onShift && firstIn ? (
            <div className="flex flex-col items-center gap-1.5">
              <span className="inline-flex items-center gap-2 rounded-full bg-success-light px-3 py-1 text-sm font-medium text-success">
                <span className="size-2 rounded-full bg-success" />
                {t("onShiftSince", { time: formatTashkentTime(firstIn, locale) })}
              </span>
              <p className="text-sm text-muted-foreground">
                {t("workedSoFar", { value: formatMinutes(today?.workedMinutes) })}
              </p>
            </div>
          ) : closed ? (
            <div className="flex flex-col items-center gap-1.5">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">
                <Check className="size-4" />
                {t("shiftClosed")}
              </span>
              <p className="text-sm text-muted-foreground">
                {t("workedTotal", { value: formatMinutes(today?.workedMinutes) })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("notMarkedYet")}</p>
          )}

          <Button
            variant={onShift ? "outline" : "default"}
            onClick={() => void mark()}
            disabled={marking || (qrMode && !qrToken.trim())}
            className="h-14 w-full max-w-xs gap-2 text-base"
          >
            {marking ? (
              <Spinner className="size-5" />
            ) : onShift ? (
              <LogOut className="size-5" />
            ) : (
              <LogIn className="size-5" />
            )}
            {geoPending
              ? t("locating")
              : onShift
                ? t("markOut")
                : t("markIn")}
          </Button>

          {justMarked && (
            <p className="inline-flex items-center gap-1.5 text-sm text-success duration-450 animate-in fade-in">
              <Check className="size-4" />
              {t("saved")}
            </p>
          )}

          {qrMode ? (
            <div className="flex w-full max-w-xs flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t("qrHint")}</p>
              <Input
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder={t("qrPlaceholder")}
              />
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setQrMode(false);
                  setQrToken("");
                }}
              >
                {t("qrCancel")}
              </Button>
            </div>
          ) : (
            <Button
              variant="link"
              size="sm"
              className="gap-1.5"
              onClick={() => setQrMode(true)}
            >
              <QrCode className="size-4" />
              {t("qrSwitch")}
            </Button>
          )}
        </CardContent>
      </Card>

      {outOfZone && (
        <div className="flex items-start gap-3 rounded-lg bg-warning-light p-4 text-sm text-warning duration-450 animate-in fade-in slide-in-from-bottom-4">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              {outOfZone.distance !== null
                ? t("outOfZoneWithDistance", { meters: outOfZone.distance })
                : t("outOfZone")}
            </span>
            <span className="opacity-90">{t("outOfZoneHint")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
