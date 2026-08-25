"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import {
  disablePush,
  enablePush,
  isBrowserPushSupported,
  isPushConfigured,
  isPushEnabled,
  pushPermission,
} from "@/lib/web-push";

type PushState =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "blocked"
  | "off"
  | "on";

/** Управление push-уведомлениями в профиле: статус + включить/отключить */
export function PushSettings() {
  const t = useTranslations("Notifications");
  const { can } = useCurrentUser();
  const canSend = can(PERMISSIONS.notificationsSend);

  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const compute = useCallback(async () => {
    if (!(await isBrowserPushSupported())) {
      setState("unsupported");
      return;
    }
    if (!isPushConfigured()) {
      setState("unconfigured");
      return;
    }
    if (pushPermission() === "denied") {
      setState("blocked");
      return;
    }
    setState(isPushEnabled() ? "on" : "off");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState после await внутри compute
    void compute();
  }, [compute]);

  async function turnOn() {
    setBusy(true);
    try {
      const ok = await enablePush(false);
      if (ok) {
        toast.success(t("pushEnabled"));
        setState("on");
      } else if (pushPermission() === "denied") {
        toast.error(t("pushBlocked"));
        setState("blocked");
      } else {
        toast.error(t("pushFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      toast.success(t("pushDisabled"));
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  // Пока грузится — ничего. Технические состояния показываем только тем, кто
  // управляет рассылкой (обычным пользователям не о чем беспокоиться).
  if (state === "loading") return null;
  if ((state === "unsupported" || state === "unconfigured") && !canSend)
    return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-5 duration-450 animate-in fade-in slide-in-from-bottom-4 [animation-delay:120ms] [animation-fill-mode:backwards]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light">
            <BellRing className="size-4.5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex min-w-0 flex-col">
            <h3 className="font-semibold">{t("settingsTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("settingsHint")}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {state === "on" && (
            <>
              <Badge
                variant="secondary"
                className="bg-success-light text-success"
              >
                {t("statusOn")}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={turnOff}
              >
                {busy ? <Spinner className="size-4" /> : t("disable")}
              </Button>
            </>
          )}
          {state === "off" && (
            <Button size="sm" disabled={busy} onClick={turnOn}>
              {busy ? <Spinner className="size-4" /> : t("enable")}
            </Button>
          )}
          {state === "blocked" && (
            <Badge variant="secondary" className="bg-warning-light text-warning">
              {t("statusBlocked")}
            </Badge>
          )}
          {state === "unconfigured" && (
            <Badge variant="secondary">{t("statusNotConfigured")}</Badge>
          )}
          {state === "unsupported" && (
            <Badge variant="secondary">{t("statusUnsupported")}</Badge>
          )}
        </div>
      </div>

      {state === "blocked" && (
        <p className="text-xs text-muted-foreground">{t("pushBlocked")}</p>
      )}
      {state === "unconfigured" && (
        <p className="text-xs text-muted-foreground">{t("notConfiguredHint")}</p>
      )}
    </section>
  );
}
