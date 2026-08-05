"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Gauge, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/shell/page-header";
import type { TicketSeverity } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { severitiesApi, SessionExpiredError } from "@/lib/api-authed";
import { useRouter } from "@/i18n/navigation";
import { pickLocalized } from "@/lib/format";
import { useDelayed } from "@/hooks/use-delayed";

const LOCALES = ["ru", "uz", "en"] as const;

function formatSla(minutes: number, t: (key: string, values?: Record<string, string | number>) => string) {
  if (minutes % 60 === 0 && minutes >= 60) return t("slaHours", { hours: minutes / 60 });
  return t("slaMinutes", { minutes });
}

export function SeveritiesManager() {
  const t = useTranslations("AdminSeverities");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState<TicketSeverity[] | null>(null);
  const [editing, setEditing] = useState<TicketSeverity | null>(null);
  const [creating, setCreating] = useState(false);
  const showSkeleton = useDelayed(!items);

  const [names, setNames] = useState({ ru: "", uz: "", en: "" });
  const [color, setColor] = useState("#d32f2f");
  const [sla, setSla] = useState("60");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    severitiesApi
      .list()
      .then((list) => setItems([...list].sort((a, b) => a.order - b.order)))
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else setItems([]);
      });
  }, [router]);

  useEffect(load, [load]);

  const dialogOpen = creating || !!editing;

  function openCreate() {
    setNames({ ru: "", uz: "", en: "" });
    setColor("#d32f2f");
    setSla("60");
    setIsDefault(false);
    setError(null);
    setCreating(true);
  }

  function openEdit(severity: TicketSeverity) {
    setNames({
      ru: severity.name.ru ?? "",
      uz: severity.name.uz ?? "",
      en: severity.name.en ?? "",
    });
    setColor(severity.color);
    setSla(String(severity.slaMinutes));
    setIsDefault(severity.isDefault);
    setError(null);
    setEditing(severity);
  }

  async function save() {
    const minutes = Number(sla);
    if (!names.ru.trim() || !Number.isInteger(minutes) || minutes < 1) {
      setError(t("validation"));
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name: {
        ru: names.ru.trim(),
        uz: names.uz.trim() || undefined,
        en: names.en.trim() || undefined,
      },
      color,
      slaMinutes: minutes,
      isDefault,
    };
    try {
      if (editing) await severitiesApi.update(editing.id, body);
      else await severitiesApi.create(body);
      toast.success(t("saved"));
      setCreating(false);
      setEditing(null);
      load();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(severity: TicketSeverity) {
    try {
      await severitiesApi.remove(severity.id);
      toast.success(t("deleted"));
      load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER411") toast.error(t("errors.ER411"));
      else toast.error(t("errors.generic"));
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("description")}>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          {t("create")}
        </Button>
      </PageHeader>

      {!items ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <Gauge className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((severity, i) => (
            <div
              key={severity.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 duration-300 animate-in fade-in [animation-fill-mode:backwards]"
              style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: severity.color }}
              />
              <span className="flex min-w-0 flex-1 items-center gap-2 truncate font-medium">
                {pickLocalized(severity.name, locale)}
                {severity.isDefault && (
                  <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <Star className="size-3 fill-warning text-warning" />
                    {t("default")}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                SLA {formatSla(severity.slaMinutes, t)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tc("edit")}
                  onClick={() => openEdit(severity)}
                  className="text-muted-foreground"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tc("delete")}
                  onClick={() => remove(severity)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("editTitle") : t("create")}</DialogTitle>
            <DialogDescription>{t("formHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {LOCALES.map((code) => (
              <div key={code} className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`sev-name-${code}`}
                  className="text-sm font-medium text-muted-foreground uppercase"
                >
                  {code}
                </Label>
                <Input
                  id={`sev-name-${code}`}
                  value={names[code]}
                  maxLength={100}
                  onChange={(e) =>
                    setNames((prev) => ({ ...prev, [code]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sev-color" className="text-sm font-medium text-muted-foreground">
                  {t("color")}
                </Label>
                <Input
                  id="sev-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-20 cursor-pointer p-1"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sev-sla" className="text-sm font-medium text-muted-foreground">
                  {t("slaLabel")}
                </Label>
                <Input
                  id="sev-sla"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={sla}
                  onChange={(e) => setSla(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={isDefault}
                onCheckedChange={(v) => setIsDefault(v === true)}
              />
              {t("makeDefault")}
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              {tc("cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Spinner className="size-4" /> : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
