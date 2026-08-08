"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { Setting } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { settingsApi, SessionExpiredError } from "@/lib/api-authed";
import { useDelayed } from "@/hooks/use-delayed";
import { useRouter } from "@/i18n/navigation";

/**
 * Глобальные настройки: метаданные (тип, подпись, границы) приходят
 * из реестра на сервере, поэтому форма строится динамически —
 * новая настройка в API появляется здесь без правок кабинета.
 */
export function SettingsForm() {
  const t = useTranslations("AdminSettings");
  const router = useRouter();

  const [items, setItems] = useState<Setting[] | null>(null);
  /** Черновики значений по ключу — сохраняются по кнопке */
  const [drafts, setDrafts] = useState<Record<string, string | boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const showSkeleton = useDelayed(!items);

  const load = useCallback(() => {
    settingsApi
      .list()
      .then((list) => {
        setItems(list);
        setDrafts(
          Object.fromEntries(
            list.map((setting) => [
              setting.key,
              setting.type === "boolean"
                ? Boolean(setting.value)
                : String(setting.value),
            ])
          )
        );
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else setItems([]);
      });
  }, [router]);

  useEffect(load, [load]);

  async function save(setting: Setting) {
    const draft = drafts[setting.key];
    let value: number | string | boolean;
    if (setting.type === "number") {
      const parsed = Number(String(draft).replace(",", "."));
      if (!Number.isFinite(parsed)) {
        setErrors((prev) => ({ ...prev, [setting.key]: t("notANumber") }));
        return;
      }
      value = parsed;
    } else if (setting.type === "boolean") {
      value = Boolean(draft);
    } else {
      value = String(draft);
    }

    setSavingKey(setting.key);
    setErrors((prev) => ({ ...prev, [setting.key]: "" }));
    try {
      const updated = await settingsApi.update(setting.key, value);
      setItems(
        (prev) =>
          prev?.map((s) => (s.key === updated.key ? updated : s)) ?? prev
      );
      toast.success(t("saved"));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1001") {
        const data = (e.data ?? {}) as { min?: number; max?: number };
        setErrors((prev) => ({
          ...prev,
          [setting.key]:
            data.min !== undefined || data.max !== undefined
              ? t("outOfRange", { min: data.min ?? "—", max: data.max ?? "—" })
              : t("invalidValue"),
        }));
      } else {
        setErrors((prev) => ({ ...prev, [setting.key]: t("genericError") }));
      }
    } finally {
      setSavingKey(null);
    }
  }

  function isDirty(setting: Setting) {
    const draft = drafts[setting.key];
    return setting.type === "boolean"
      ? Boolean(draft) !== Boolean(setting.value)
      : String(draft) !== String(setting.value);
  }

  if (!items) {
    return (
      <div className="flex max-w-2xl flex-col gap-2">
        {showSkeleton &&
          Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg animate-in fade-in duration-300" />
          ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
        <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
          <SlidersHorizontal className="size-[26px] text-primary" strokeWidth={1.75} />
        </div>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {items.map((setting, i) => (
        <div
          key={setting.key}
          className="flex flex-col gap-3 rounded-lg border border-border p-4 duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
          style={{ animationDelay: `${Math.min(i * 50, 200)}ms` }}
        >
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`setting-${setting.key}`} className="text-sm font-medium">
              {setting.label}
            </Label>
            <span className="font-mono text-xs text-muted-foreground">
              {setting.key}
            </span>
            {setting.description && (
              <span className="text-xs text-muted-foreground">
                {setting.description}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {setting.type === "boolean" ? (
              <Switch
                checked={Boolean(drafts[setting.key])}
                onCheckedChange={(v) =>
                  setDrafts((prev) => ({ ...prev, [setting.key]: v }))
                }
                aria-label={setting.label}
              />
            ) : (
              <Input
                id={`setting-${setting.key}`}
                inputMode={setting.type === "number" ? "decimal" : "text"}
                value={String(drafts[setting.key] ?? "")}
                onChange={(e) => {
                  setDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }));
                  setErrors((prev) => ({ ...prev, [setting.key]: "" }));
                }}
                className="w-48 tabular-nums"
              />
            )}

            {setting.type === "number" &&
              (setting.min !== undefined || setting.max !== undefined) && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("range", {
                    min: setting.min?.toLocaleString("ru-RU") ?? "—",
                    max: setting.max?.toLocaleString("ru-RU") ?? "—",
                  })}
                </span>
              )}

            <div className="ms-auto flex items-center gap-1.5">
              {isDirty(setting) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("reset")}
                  onClick={() =>
                    setDrafts((prev) => ({
                      ...prev,
                      [setting.key]:
                        setting.type === "boolean"
                          ? Boolean(setting.value)
                          : String(setting.value),
                    }))
                  }
                  className="text-muted-foreground"
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
              <Button
                size="sm"
                disabled={!isDirty(setting) || savingKey === setting.key}
                onClick={() => save(setting)}
              >
                {savingKey === setting.key ? (
                  <Spinner className="size-4" />
                ) : (
                  t("save")
                )}
              </Button>
            </div>
          </div>

          {errors[setting.key] && (
            <p className="text-xs text-destructive">{errors[setting.key]}</p>
          )}
        </div>
      ))}
    </div>
  );
}
