"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Layers,
  Search,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { MonthPicker } from "@/components/common/month-picker";
import {
  ApiError,
  type BulkInvoicePreview,
  type BulkInvoiceResult,
  type LegalEntity,
} from "@/lib/api";
import { invoicesApi, legalEntitiesApi, SessionExpiredError } from "@/lib/api-authed";
import { logActivity } from "@/lib/activity-log";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatSum } from "./invoice-format";

const MAX_BULK = 100;

type Step = "configure" | "preview" | "result";

/** Экран 3: массовое выставление — двухшаговый мастер (предпросмотр → выпуск) */
export function BulkInvoiceDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  /** После выпуска — чтобы список счетов перезагрузился */
  onDone: () => void;
}) {
  const t = useTranslations("Invoices.bulk");
  const tc = useTranslations("Common");
  const locale = useLocale();

  const [step, setStep] = useState<Step>("configure");
  const [period, setPeriod] = useState("");
  /** пусто — все ЮЛ (опасный дефолт, показываем явно) */
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<BulkInvoicePreview | null>(null);
  const [result, setResult] = useState<BulkInvoiceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const generatingRef = useRef(false);

  const selectedIds = Object.keys(selected);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при открытии
    setStep("configure");
    setPeriod("");
    setSelected({});
    setPreview(null);
    setResult(null);
    setLoading(false);
    generatingRef.current = false;
  }, [open]);

  function body() {
    return {
      period: period || undefined,
      legalEntityIds: selectedIds.length ? selectedIds : undefined,
    };
  }

  async function runPreview() {
    setLoading(true);
    try {
      const p = await invoicesApi.bulkPreview(body());
      setPreview(p);
      setStep("preview");
    } catch (e) {
      if (e instanceof SessionExpiredError) return;
      toast.error(t("previewError"));
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (generatingRef.current) return; // защита от двойного клика
    generatingRef.current = true;
    setLoading(true);
    try {
      const r = await invoicesApi.bulk(body());
      setResult(r);
      setStep("result");
      logActivity({ type: "invoice.bulk", meta: { count: r.createdCount } });
      if (r.createdCount > 0) toast.success(t("generated", { count: r.createdCount }));
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1606") {
        toast.error(t("tooMany", { max: MAX_BULK, count: Number(e.data?.count ?? 0) }));
      } else {
        toast.error(t("generateError"));
      }
      generatingRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  const overLimit = !!preview && preview.entitiesTotal > MAX_BULK;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        {step === "configure" && (
          <ConfigureStep
            period={period}
            setPeriod={setPeriod}
            selected={selected}
            setSelected={setSelected}
          />
        )}

        {step === "preview" && preview && (
          <PreviewStep preview={preview} locale={locale} overLimit={overLimit} />
        )}

        {step === "result" && result && (
          <ResultStep result={result} locale={locale} />
        )}

        {/* Футер */}
        <div className="flex items-center justify-between gap-2">
          {step === "preview" ? (
            <Button
              variant="ghost"
              onClick={() => setStep("configure")}
              disabled={loading}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" />
              {tc("back")}
            </Button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            {step === "result" ? (
              <Button onClick={onClose}>{tc("done")}</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={onClose} disabled={loading}>
                  {tc("cancel")}
                </Button>
                {step === "configure" && (
                  <Button onClick={() => void runPreview()} disabled={loading} className="gap-2">
                    {loading ? <Spinner className="size-4" /> : <Search className="size-4" />}
                    {t("doPreview")}
                  </Button>
                )}
                {step === "preview" && (
                  <Button
                    onClick={() => void generate()}
                    disabled={loading || overLimit || preview?.toIssue === 0}
                    className="gap-2"
                  >
                    {loading ? <Spinner className="size-4" /> : <Layers className="size-4" />}
                    {t("doGenerate", { count: preview?.toIssue ?? 0 })}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Шаг 1: период + выбор ЮЛ (пусто = все) */
function ConfigureStep({
  period,
  setPeriod,
  selected,
  setSelected,
}: {
  period: string;
  setPeriod: (v: string) => void;
  selected: Record<string, string>;
  setSelected: (v: Record<string, string>) => void;
}) {
  const t = useTranslations("Invoices.bulk");
  const [mode, setMode] = useState<"all" | "pick">(
    Object.keys(selected).length ? "pick" : "all"
  );
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350);
  const [options, setOptions] = useState<LegalEntity[] | null>(null);

  useEffect(() => {
    if (mode !== "pick") return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- индикатор загрузки перед запросом
    setOptions(null);
    legalEntitiesApi
      .list({ search: debounced || undefined, limit: 50 })
      .then((page) => !cancelled && setOptions(page.items))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [mode, debounced]);

  const selectedIds = Object.keys(selected);
  const count = selectedIds.length;

  function toggle(e: LegalEntity) {
    const next = { ...selected };
    if (next[e.id]) delete next[e.id];
    else next[e.id] = e.name;
    setSelected(next);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Период */}
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm text-muted-foreground">{t("period")}</label>
        <MonthPicker value={period} onChange={setPeriod} placeholder={t("periodAll")} />
      </div>

      {/* Режим выбора */}
      <div className="flex rounded-lg border border-border p-1">
        <button
          type="button"
          onClick={() => {
            setMode("all");
            setSelected({});
          }}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("modeAll")}
        </button>
        <button
          type="button"
          onClick={() => setMode("pick")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "pick" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("modePick")}
        </button>
      </div>

      {mode === "all" ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-light/40 p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <span className="text-sm text-warning">{t("allWarning")}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchEntity")}
              className="pl-9"
            />
          </div>
          {count > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("picked", { count })}
            </span>
          )}
          {!options ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noEntities")}
            </p>
          ) : (
            <div className="-mr-1 flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1">
              {options.map((e) => {
                const on = !!selected[e.id];
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggle(e)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      on ? "border-primary/40 bg-accent-light" : "border-border hover:border-primary/30"
                    )}
                  >
                    <Checkbox checked={on} className="pointer-events-none" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{e.name}</span>
                      <span className="truncate text-xs tabular-nums text-muted-foreground">
                        {e.taxId}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Шаг 2: предпросмотр — крупно ИТОГО + разбивка + пропущенные */
function PreviewStep({
  preview,
  locale,
  overLimit,
}: {
  preview: BulkInvoicePreview;
  locale: string;
  overLimit: boolean;
}) {
  const t = useTranslations("Invoices.bulk");
  const errors = preview.skipped.filter((s) => s.reason === "error");
  const noSources = preview.skipped.filter((s) => s.reason === "no-sources");

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
      {/* Крупно: ИТОГО и количество */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Users className="size-3.5" />
            {t("toIssue")}
          </span>
          <span className="text-2xl font-bold tabular-nums">{preview.toIssue}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("total")}
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {formatSum(preview.totalSum, locale)}
          </span>
        </div>
      </div>

      {/* Лимит 100 */}
      {overLimit && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="text-sm text-destructive">
            {t("overLimit", { count: preview.entitiesTotal, max: MAX_BULK })}
          </span>
        </div>
      )}

      {/* Разбивка по ЮЛ */}
      {preview.items.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("breakdown")}
          </span>
          <div className="flex flex-col divide-y divide-border">
            {preview.items.map((it) => (
              <div key={it.legalEntityId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{it.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  ×{it.sourceCount}
                </span>
                <span className="shrink-0 tabular-nums font-medium">
                  {formatSum(it.totalSum, locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Сбои — заметно */}
      {errors.length > 0 && (
        <SkippedBlock
          variant="error"
          title={t("errorsTitle", { count: errors.length })}
          items={errors.map((s) => s.name)}
        />
      )}

      {/* Нечего выставлять — норма */}
      {noSources.length > 0 && (
        <SkippedBlock
          variant="muted"
          title={t("noSourcesTitle", { count: noSources.length })}
          items={noSources.map((s) => s.name)}
        />
      )}
    </div>
  );
}

function SkippedBlock({
  variant,
  title,
  items,
}: {
  variant: "error" | "muted";
  title: string;
  items: string[];
}) {
  const [open, setOpen] = useState(variant === "error");
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        variant === "error"
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-secondary/30"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-left text-sm font-medium"
      >
        {variant === "error" ? (
          <TriangleAlert className="size-4 shrink-0 text-destructive" />
        ) : (
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
        )}
        <span className={variant === "error" ? "text-destructive" : "text-muted-foreground"}>
          {title}
        </span>
      </button>
      {open && (
        <ul className="flex flex-col gap-0.5 ps-6 text-sm text-muted-foreground">
          {items.map((name, i) => (
            <li key={i} className="truncate">{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Шаг 3: результат — созданные счета со ссылками + пропущенные */
function ResultStep({
  result,
  locale,
}: {
  result: BulkInvoiceResult;
  locale: string;
}) {
  const t = useTranslations("Invoices.bulk");
  const errors = result.skipped.filter((s) => s.reason === "error");

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-light/50 p-4">
        <CheckCircle2 className="size-6 shrink-0 text-success" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-success">
            {t("resultTitle", { count: result.createdCount })}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("resultTotal", { total: formatSum(result.totalSum, locale) })}
          </span>
        </div>
      </div>

      {result.created.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
          <div className="flex flex-col divide-y divide-border">
            {result.created.map((c) => (
              <Link
                key={c.invoiceId}
                href={`/invoices/${c.invoiceId}`}
                className="flex items-center justify-between gap-3 py-1.5 text-sm transition-colors hover:text-primary"
              >
                <span className="shrink-0 font-medium tabular-nums">{c.number}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.name}</span>
                <span className="shrink-0 tabular-nums font-medium">
                  {formatSum(c.totalSum, locale)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <SkippedBlock
          variant="error"
          title={t("errorsTitle", { count: errors.length })}
          items={errors.map((s) => s.name)}
        />
      )}
    </div>
  );
}
