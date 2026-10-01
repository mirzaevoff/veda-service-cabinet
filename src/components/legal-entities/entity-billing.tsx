"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleDot, ReceiptText, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { LegalEntity } from "@/lib/api";
import { legalEntitiesApi, telegramApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Экран 2: настройки биллинга на карточке ЮЛ (автоотправка + автовыставление) */
export function EntityBilling({
  entity,
  onChanged,
}: {
  entity: LegalEntity;
  onChanged: () => void;
}) {
  const t = useTranslations("LegalEntities.billing");
  const locale = useLocale();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.legalEntitiesManage);
  const canTelegram = can(PERMISSIONS.telegramManage);

  const billing = entity.billing;
  const [saving, setSaving] = useState<null | "telegram" | "auto" | "day">(null);
  const [day, setDay] = useState(String(billing.autoInvoice.dayOfMonth));
  /** есть ли у ЮЛ активная привязанная группа (undefined — ещё не знаем) */
  const [hasGroup, setHasGroup] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация инпута с сервером после сохранения
    setDay(String(billing.autoInvoice.dayOfMonth));
  }, [billing.autoInvoice.dayOfMonth]);

  useEffect(() => {
    if (!canTelegram) return;
    let cancelled = false;
    telegramApi
      .list(entity.id)
      .then((chats) => {
        if (!cancelled) setHasGroup(chats.some((c) => c.active));
      })
      .catch(() => !cancelled && setHasGroup(undefined));
    return () => {
      cancelled = true;
    };
  }, [entity.id, canTelegram]);

  async function patch(
    billingPatch: Parameters<typeof legalEntitiesApi.update>[1]["billing"],
    kind: "telegram" | "auto" | "day"
  ) {
    setSaving(kind);
    try {
      await legalEntitiesApi.update(entity.id, { billing: billingPatch });
      toast.success(t("saved"));
      onChanged();
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(null);
    }
  }

  function commitDay() {
    const n = Math.min(28, Math.max(1, Number(day) || billing.autoInvoice.dayOfMonth));
    setDay(String(n));
    if (n !== billing.autoInvoice.dayOfMonth)
      void patch({ autoInvoice: { dayOfMonth: n } }, "day");
  }

  const lastRun = formatMonth(billing.autoInvoice.lastRunMonth, locale);
  const telegramDisabled = !canManage || saving !== null || hasGroup === false;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
          <ReceiptText className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </h4>
      </div>

      {/* Месячный цикл — таймлайн */}
      <CycleTimeline flaggedAt={billing.criticalFlaggedAt} />

      {/* Пометка «на контроле» (НЕ блокировка) */}
      {billing.criticalFlaggedAt && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-light/40 p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium text-warning">
              {t("flaggedTitle", { date: formatDate(billing.criticalFlaggedAt, locale) })}
            </span>
            <span className="text-muted-foreground">{t("flaggedHint")}</span>
          </div>
        </div>
      )}

      {/* Автоотправка счёта в Telegram */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">{t("telegramAutoSend")}</span>
            <span className="flex items-center gap-1 text-xs text-warning">
              <Send className="size-3" />
              {t("clientSees")}
            </span>
          </div>
          <Switch
            checked={billing.telegramAutoSendInvoice}
            disabled={telegramDisabled}
            onCheckedChange={(v) =>
              patch({ telegramAutoSendInvoice: v }, "telegram")
            }
            aria-label={t("telegramAutoSend")}
          />
        </div>
        {hasGroup === false && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TriangleAlert className="size-3 text-warning" />
            {t("noGroup")}
            {canTelegram && (
              <Link
                href="/finance?tab=telegram"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {t("bindGroup")}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Автовыставление */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">{t("autoInvoice")}</span>
            <span className="text-xs text-muted-foreground">{t("autoInvoiceHint")}</span>
          </div>
          <Switch
            checked={billing.autoInvoice.enabled}
            disabled={!canManage || saving !== null}
            onCheckedChange={(v) =>
              patch({ autoInvoice: { enabled: v } }, "auto")
            }
            aria-label={t("autoInvoice")}
          />
        </div>

        {billing.autoInvoice.enabled && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-secondary/40 p-3">
            <label htmlFor="billing-day" className="text-sm text-muted-foreground">
              {t("dayOfMonth")}
            </label>
            <Input
              id="billing-day"
              type="number"
              min={1}
              max={28}
              value={day}
              disabled={!canManage || saving !== null}
              onChange={(e) => setDay(e.target.value)}
              onBlur={commitDay}
              onKeyDown={(e) => e.key === "Enter" && commitDay()}
              className="h-8 w-20 tabular-nums"
            />
            <span className="text-xs text-muted-foreground">{t("dayHint")}</span>
            {lastRun && (
              <span className="ms-auto text-xs text-muted-foreground">
                {t("lastRun", { month: lastRun })}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Таймлайн месячного цикла: 25 → 1 → 2 → 5 */
function CycleTimeline({ flaggedAt }: { flaggedAt: string | null }) {
  const t = useTranslations("LegalEntities.billing.cycle");
  const steps = [
    { day: "25", label: t("autoIssue"), accent: false },
    { day: "1", label: t("dueReminder"), accent: false },
    { day: "2", label: t("overdue"), accent: false },
    { day: "5", label: t("flag"), accent: !!flaggedAt },
  ];
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {steps.map((s) => (
        <div
          key={s.day}
          className={cn(
            "flex min-w-[88px] flex-1 flex-col gap-1 rounded-lg border p-2.5",
            s.accent
              ? "border-warning/40 bg-warning-light/40"
              : "border-border bg-secondary/30"
          )}
        >
          <span className="flex items-center gap-1 text-xs font-semibold tabular-nums">
            <CircleDot
              className={cn(
                "size-3",
                s.accent ? "text-warning" : "text-muted-foreground"
              )}
            />
            {s.day}
          </span>
          <span className="text-xs leading-tight text-muted-foreground">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** «2026-09» → «сентябрь 2026»; пусто → "" */
function formatMonth(ym: string, locale: string): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "";
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}
