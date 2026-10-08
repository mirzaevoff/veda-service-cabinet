"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  FileSpreadsheet,
  Info,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  ApiError,
  type BankAccount,
  type StatementImportPreview,
  type StatementImportResult,
} from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatTiyin } from "./bank-money";

const ROWS_SHOWN = 50;

/**
 * Экран 4: импорт выписки — строго два шага. Предпросмотр ничего не пишет;
 * «Загрузить» неактивна, пока суммы не сошлись с выпиской (balanced=false).
 */
export function StatementImportDialog({
  open,
  account,
  onClose,
  onImported,
}: {
  open: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const t = useTranslations("Bank.import");
  const tc = useTranslations("Common");
  const locale = useLocale();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StatementImportPreview | null>(null);
  const [result, setResult] = useState<StatementImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const committingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- сброс при открытии */
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    committingRef.current = false;
  }, [open]);

  function errorText(e: unknown): string {
    const code = e instanceof ApiError ? e.code : "";
    if (code === "ER1213") return t("errors.unreadable");
    if (code === "ER1214") return t("errors.unknownFormat");
    if (code === "ER1215") return t("errors.unbalanced");
    if (code === "ER1207") return t("errors.synced");
    if (code === "NETWORK") return t("errors.network");
    if (e instanceof ApiError && e.status === 413) return t("errors.tooBig");
    return t("errors.generic");
  }

  async function runPreview(f: File) {
    if (!account) return;
    setFile(f);
    setPreview(null);
    setError(null);
    setBusy(true);
    try {
      setPreview(await bankApi.statements.preview(account.id, f));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!account || !file || !preview?.balanced) return;
    if (committingRef.current) return; // двойной клик
    committingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await bankApi.statements.commit(account.id, file);
      setResult(r);
      toast.success(t("done", { count: r.inserted }));
      onImported();
    } catch (e) {
      setError(errorText(e));
      committingRef.current = false;
    } finally {
      setBusy(false);
    }
  }

  // Мягкая проверка «та ли выписка»: сравниваем последние 4 цифры, если они есть с обеих сторон
  const ownDigits = (account?.account ?? "").replace(/\D/g, "");
  const fileDigits = (preview?.accountNumber ?? "").replace(/\D/g, "");
  const accountMismatch =
    ownDigits.length >= 4 && fileDigits.length >= 4 && ownDigits.slice(-4) !== fileDigits.slice(-4);

  const failedChecks = preview?.checks.filter((c) => !c.matches) ?? [];
  const canCommit = !!preview && preview.balanced && preview.rowsNew > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{account?.title}</DialogDescription>
        </DialogHeader>

        {result ? (
          // --- Готово ---
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-light/50 p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="font-semibold text-success">
                  {t("resultInserted", { count: result.inserted })}
                </span>
                {result.duplicates > 0 && (
                  <span className="text-muted-foreground">
                    {t("resultDuplicates", { count: result.duplicates })}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {t("resultBalance", { sum: formatTiyin(result.balanceTiyin) })}
                </span>
                {result.topups.created > 0 && (
                  <span className="text-muted-foreground">
                    {t("resultTopups", {
                      created: result.topups.created,
                      recognized: result.topups.recognized,
                    })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onClose}>{tc("done")}</Button>
            </div>
          </div>
        ) : !preview ? (
          // --- Шаг 1: файл ---
          <div className="flex flex-col gap-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {busy ? (
                <>
                  <Spinner className="size-5" />
                  {t("parsing")}
                </>
              ) : (
                <>
                  <FileSpreadsheet className="size-7" strokeWidth={1.5} />
                  <span className="font-medium text-foreground">{t("pick")}</span>
                  <span className="text-xs">{t("pickHint")}</span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void runPreview(f);
              }}
            />

            {/* ОФБ — обязательно на экране */}
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-light/40 p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-warning">{t("ofbTitle")}</span>
                <span className="text-muted-foreground">{t("ofbHint")}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("supported")}</p>

            {error && <ErrorBox text={error} />}
          </div>
        ) : (
          // --- Шаг 2: предпросмотр ---
          <div className="flex max-h-[68vh] flex-col gap-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">{preview.bank}</span>
              {preview.accountNumber && (
                <span className="text-muted-foreground tabular-nums">{preview.accountNumber}</span>
              )}
              {preview.period && (
                <span className="text-muted-foreground tabular-nums">
                  {formatDay(preview.period.from, locale)} — {formatDay(preview.period.to, locale)}
                </span>
              )}
              <span className="ms-auto truncate text-xs text-muted-foreground">{file?.name}</span>
            </div>

            {accountMismatch && (
              <ErrorBox tone="warning" text={t("accountMismatch", { account: account?.account ?? "" })} />
            )}

            {/* Сверка с арифметикой банка */}
            {preview.balanced ? (
              <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-light/50 px-3 py-2.5 text-sm text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                {t("balanced")}
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <span className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <XCircle className="size-4 shrink-0" />
                  {t("unbalancedTitle")}
                </span>
                <span className="text-sm text-muted-foreground">{t("unbalancedHint")}</span>
              </div>
            )}

            {preview.checks.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t("checkLabel")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("checkExpected")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("checkActual")}</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* несошедшиеся — сверху */}
                    {[...failedChecks, ...preview.checks.filter((c) => c.matches)].map((c, i) => (
                      <tr key={i} className={cn(!c.matches && "bg-destructive/5")}>
                        <td className={cn("px-3 py-2", !c.matches && "font-medium text-destructive")}>
                          {c.label}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTiyin(c.expectedTiyin)}</td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right tabular-nums",
                            !c.matches && "font-semibold text-destructive"
                          )}
                        >
                          {formatTiyin(c.actualTiyin)}
                        </td>
                        <td className="pr-3 text-right">
                          {c.matches ? (
                            <CheckCircle2 className="ms-auto size-4 text-success" />
                          ) : (
                            <XCircle className="ms-auto size-4 text-destructive" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Итоги */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={t("rowsNew")} value={String(preview.rowsNew)} strong />
              <Stat label={t("rowsDuplicate")} value={String(preview.rowsDuplicate)} />
              <Stat label={t("totalIn")} value={`+${formatTiyin(preview.totalInTiyin)}`} tone="in" />
              <Stat label={t("totalOut")} value={`−${formatTiyin(preview.totalOutTiyin)}`} />
            </div>

            {preview.rowsDuplicate > 0 && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {t("duplicatesNormal", { count: preview.rowsDuplicate })}
              </p>
            )}
            {preview.rowsNew === 0 && preview.balanced && (
              <p className="text-sm text-muted-foreground">{t("nothingNew")}</p>
            )}

            {/* Нераспознанные строки — не молчим */}
            {preview.skipped.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-warning/40 bg-warning-light/30 p-3">
                <span className="flex items-center gap-2 text-sm font-medium text-warning">
                  <CircleAlert className="size-4" />
                  {t("skippedTitle", { count: preview.skipped.length })}
                </span>
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {preview.skipped.slice(0, 20).map((s) => (
                    <li key={s.sheetRow} className="flex gap-2">
                      <span className="shrink-0 tabular-nums">{t("row", { n: s.sheetRow })}</span>
                      <span className="min-w-0 truncate">
                        {s.reason}
                        {s.preview && ` — ${s.preview}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Сами операции */}
            {preview.rows.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="divide-y divide-border">
                  {preview.rows.slice(0, ROWS_SHOWN).map((r) => (
                    <div
                      key={`${r.sheetRow}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm",
                        r.status === "duplicate" && "text-muted-foreground"
                      )}
                    >
                      <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatDay(r.docDate, locale)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{r.counterpartyName || "—"}</span>
                        {r.purpose && (
                          <span className="truncate text-xs text-muted-foreground">{r.purpose}</span>
                        )}
                      </span>
                      {r.status === "duplicate" && (
                        <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px]">
                          {t("alreadyLoaded")}
                        </span>
                      )}
                      <span
                        className={cn(
                          "shrink-0 font-medium tabular-nums",
                          r.direction === "in" && r.status === "new" && "text-success"
                        )}
                      >
                        {r.direction === "in" ? "+" : "−"}
                        {formatTiyin(r.amountTiyin)}
                      </span>
                    </div>
                  ))}
                </div>
                {preview.rows.length > ROWS_SHOWN && (
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    {t("moreRows", { count: preview.rows.length - ROWS_SHOWN })}
                  </p>
                )}
              </div>
            )}

            {error && <ErrorBox text={error} />}

            <div className="sticky bottom-0 flex items-center justify-between gap-2 bg-popover pt-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                  setError(null);
                }}
                className="gap-1.5"
              >
                <ArrowLeft className="size-4" />
                {t("otherFile")}
              </Button>
              <Button onClick={() => void commit()} disabled={!canCommit} className="gap-2">
                {busy ? <Spinner className="size-4" /> : <Upload className="size-4" />}
                {t("commit", { count: preview.rowsNew })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "in";
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-bold" : "font-semibold",
          tone === "in" && "text-success"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ text, tone = "error" }: { text: string; tone?: "error" | "warning" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        tone === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-warning/40 bg-warning-light/40 text-warning"
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
