"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { Setting } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { settingsApi, SessionExpiredError } from "@/lib/api-authed";
import { useDelayed } from "@/hooks/use-delayed";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

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
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [autofillTaxId, setAutofillTaxId] = useState("");
  const [autofillBusy, setAutofillBusy] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
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

  async function autofill() {
    if (!/^(\d{9}|\d{14})$/.test(autofillTaxId)) {
      setAutofillError(t("taxIdFormat"));
      return;
    }
    setAutofillBusy(true);
    setAutofillError(null);
    try {
      await settingsApi.organizationAutofill(autofillTaxId);
      toast.success(t("autofillDone"));
      setAutofillOpen(false);
      load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER703")
        setAutofillError(t("autofillNotFound"));
      else if (e instanceof ApiError && e.code === "ER702")
        setAutofillError(t("autofillDidoxDown"));
      else if (e instanceof ApiError && e.code === "ER101")
        setAutofillError(t("taxIdFormat"));
      else setAutofillError(t("genericError"));
    } finally {
      setAutofillBusy(false);
    }
  }

  /** Групповое сохранение: все изменённые ключи секции разом */
  async function saveGroup(settings: Setting[]) {
    const dirty = settings.filter(isDirty);
    if (dirty.length === 0) return;
    setSavingKey("__group__");
    let allOk = true;
    for (const setting of dirty) {
      try {
        const updated = await settingsApi.update(
          setting.key,
          String(drafts[setting.key] ?? "")
        );
        setItems(
          (prev) =>
            prev?.map((s) => (s.key === updated.key ? updated : s)) ?? prev
        );
        setErrors((prev) => ({ ...prev, [setting.key]: "" }));
      } catch {
        allOk = false;
        setErrors((prev) => ({ ...prev, [setting.key]: t("invalidValue") }));
      }
    }
    setSavingKey(null);
    if (allOk) toast.success(t("saved"));
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

  const groups = [...new Set(items.map((s) => s.group))];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">
              {t.has(`groups.${group}`) ? t(`groups.${group}`) : group}
            </h3>
            {group === "Organization" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const current = items.find((s) => s.key === "org.taxId");
                  setAutofillTaxId(String(current?.value ?? ""));
                  setAutofillError(null);
                  setAutofillOpen(true);
                }}
                className="gap-2"
              >
                <Sparkles className="size-4" />
                {t("autofill")}
              </Button>
            )}
          </div>
          {group === "Organization" ? (
            (() => {
              const orgSettings = items.filter((s) => s.group === group);
              const anyDirty = orgSettings.some(isDirty);
              const fullWidth = new Set(["org.name", "org.address", "org.bankName"]);
              return (
                <div className="flex flex-col gap-4 rounded-lg border border-border p-5 duration-450 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    {orgSettings.map((setting) => (
                      <div
                        key={setting.key}
                        className={cn(
                          "flex min-w-0 flex-col gap-1.5",
                          fullWidth.has(setting.key) && "sm:col-span-2"
                        )}
                      >
                        <Label
                          htmlFor={`setting-${setting.key}`}
                          className="text-sm font-medium text-muted-foreground"
                        >
                          {setting.label}
                        </Label>
                        <Input
                          id={`setting-${setting.key}`}
                          value={String(drafts[setting.key] ?? "")}
                          onChange={(e) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [setting.key]: e.target.value,
                            }));
                            setErrors((prev) => ({ ...prev, [setting.key]: "" }));
                          }}
                        />
                        {errors[setting.key] && (
                          <p className="text-xs text-destructive">
                            {errors[setting.key]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!anyDirty || savingKey === "__group__"}
                      onClick={() => saveGroup(orgSettings)}
                    >
                      {savingKey === "__group__" ? (
                        <Spinner className="size-4" />
                      ) : (
                        t("save")
                      )}
                    </Button>
                  </div>
                </div>
              );
            })()
          ) : (
            items
            .filter((s) => s.group === group)
            .map((setting, i) => (
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
                className={
                  setting.type === "number"
                    ? "w-48 tabular-nums"
                    : "min-w-0 flex-1 basis-64"
                }
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
            ))
          )}
        </section>
      ))}

      {/* Автозаполнение реквизитов организации из Didox */}
      <Dialog open={autofillOpen} onOpenChange={setAutofillOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("autofillTitle")}</DialogTitle>
            <DialogDescription>{t("autofillHint")}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void autofill();
            }}
          >
            <Input
              value={autofillTaxId}
              inputMode="numeric"
              maxLength={14}
              autoFocus
              placeholder="310529901"
              onChange={(e) => {
                setAutofillTaxId(e.target.value.replace(/\D/g, ""));
                setAutofillError(null);
              }}
              className="tabular-nums"
            />
            {autofillError && (
              <p className="text-xs text-destructive">{autofillError}</p>
            )}
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAutofillOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void autofill()} disabled={autofillBusy}>
              {autofillBusy ? <Spinner className="size-4" /> : t("autofillRun")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
