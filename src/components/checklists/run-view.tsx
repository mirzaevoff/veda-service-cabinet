"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Camera,
  Check,
  CloudUpload,
  MessageSquare,
  Star,
  Timer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { RunStatusBadge } from "./run-status-badge";
import { useRemainingMinutes } from "./runs-list";
import type { ChecklistItem, ChecklistRun } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { checklistsApi, SessionExpiredError } from "@/lib/api-authed";
import { uploadFile } from "@/lib/upload";
import { formatDay, formatTime } from "@/lib/format";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface AnswerDraft {
  value: boolean | string | number | null;
  photos: string[];
  comment: string;
}

const SAVE_DEBOUNCE_MS = 800;

function fileUrl(id: string) {
  return `/api/files/${id}`;
}

export function RunView({ runId }: { runId: string }) {
  const t = useTranslations("Checklists");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useCurrentUser();

  const [run, setRun] = useState<ChecklistRun | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<Map<string, AnswerDraft>>(new Map());
  const [commentOpen, setCommentOpen] = useState<Set<string>>(new Set());
  const [uploadingItems, setUploadingItems] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [expired, setExpired] = useState(false);
  /** Пункты с нарушениями из ER910/ER911 */
  const [violations, setViolations] = useState<Set<string>>(new Set());

  const dirtyRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Актуальные ответы для flush — обновляется вместе с setAnswers */
  const answersRef = useRef<Map<string, AnswerDraft>>(new Map());

  const remaining = useRemainingMinutes(
    run && (run.status === "pending" || run.status === "in_progress")
      ? run.expiresAt
      : null
  );

  useEffect(() => {
    checklistsApi.runs
      .get(runId)
      .then((loaded) => {
        setRun(loaded);
        const map = new Map<string, AnswerDraft>();
        for (const a of loaded.answers) {
          map.set(a.item, {
            value: a.value,
            photos: a.photos,
            comment: a.comment,
          });
        }
        answersRef.current = map;
        setAnswers(map);
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else setNotFound(true);
      });
  }, [runId, router]);

  const isExecutor = !!user && !!run && run.userId === user.id;
  const allowLate = run?.allowLateCompletion ?? true;
  // missed при allowLateCompletion остаётся заполняемым («доделать не вовремя»)
  const editable =
    isExecutor &&
    !!run &&
    (run.status === "pending" ||
      run.status === "in_progress" ||
      (run.status === "missed" && allowLate)) &&
    (allowLate || (!expired && (remaining === null || remaining > 0)));

  const flush = useCallback(async () => {
    const dirty = [...dirtyRef.current];
    if (dirty.length === 0) return;
    dirtyRef.current = new Set();
    const payload = dirty.map((item) => {
      const draft = answersRef.current.get(item)!;
      return {
        item,
        ...(draft.value !== null ? { value: draft.value } : {}),
        photos: draft.photos,
        comment: draft.comment,
      };
    });
    setSaving(true);
    try {
      const updated = await checklistsApi.runs.saveAnswers(runId, payload);
      setRun((prev) =>
        prev ? { ...prev, status: updated.status, startedAt: updated.startedAt } : prev
      );
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER913") {
        // Несвежие фото: сервер ничего не сохранил — ресинк ответов с сервера
        const data = (e.data ?? {}) as { items?: string[]; maxAgeMinutes?: number };
        toast.error(
          t("errors.ER913", { minutes: data.maxAgeMinutes ?? 0 })
        );
        setViolations(new Set(data.items ?? []));
        try {
          const fresh = await checklistsApi.runs.get(runId);
          const map = new Map<string, AnswerDraft>();
          for (const a of fresh.answers) {
            map.set(a.item, { value: a.value, photos: a.photos, comment: a.comment });
          }
          answersRef.current = map;
          setAnswers(map);
          setRun(fresh);
        } catch {
          // не смогли ресинкнуть — оставляем как есть
        }
        const first = (data.items ?? [])[0];
        if (first) {
          document
            .getElementById(`run-item-${first}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else if (e instanceof ApiError && e.code === "ER908") {
        setExpired(true);
        toast.error(t("errors.ER908"));
      } else if (e instanceof ApiError && e.code === "ER907") {
        toast.error(t("errors.ER907"));
      } else {
        // Вернуть в очередь — попробуем при следующем изменении
        for (const item of dirty) dirtyRef.current.add(item);
        toast.error(t("errors.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  }, [runId, t]);

  const queueSave = useCallback(
    (itemId: string) => {
      dirtyRef.current.add(itemId);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Сброс таймера при размонтировании + финальный сброс несохранённого
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  function draftOf(itemId: string): AnswerDraft {
    return (
      answers.get(itemId) ?? { value: null, photos: [], comment: "" }
    );
  }

  function setDraft(itemId: string, patch: Partial<AnswerDraft>) {
    setAnswers((prev) => {
      const next = new Map(prev);
      const base =
        prev.get(itemId) ?? ({ value: null, photos: [], comment: "" } as AnswerDraft);
      next.set(itemId, { ...base, ...patch });
      answersRef.current = next;
      return next;
    });
    setViolations((prev) => {
      if (!prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    queueSave(itemId);
  }

  async function addPhotos(item: ChecklistItem, files: FileList | null) {
    if (!files?.length) return;
    const current = draftOf(item.id).photos;
    const room = Math.max(0, 5 - current.length);
    const list = [...files].slice(0, room);
    if (!list.length) return;
    setUploadingItems((prev) => new Set(prev).add(item.id));
    try {
      const uploaded = await Promise.all(list.map((f) => uploadFile(f)));
      setDraft(item.id, {
        photos: [...draftOf(item.id).photos, ...uploaded.map((f) => f.id)],
      });
    } catch {
      toast.error(t("errors.uploadFailed"));
    } finally {
      setUploadingItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function complete() {
    if (timerRef.current) clearTimeout(timerRef.current);
    await flush();
    setCompleting(true);
    try {
      const done = await checklistsApi.runs.complete(runId);
      setRun(done);
      setViolations(new Set());
      toast.success(t("completedToast"));
    } catch (e) {
      if (e instanceof ApiError && (e.code === "ER910" || e.code === "ER911")) {
        const data = (e.data ?? {}) as { items?: string[]; photoItems?: string[] };
        const bad = new Set([...(data.items ?? []), ...(data.photoItems ?? [])]);
        setViolations(bad);
        toast.error(t("errors." + e.code));
        document
          .getElementById(`run-item-${[...bad][0]}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (e instanceof ApiError && e.code === "ER908") {
        setExpired(true);
        toast.error(t("errors.ER908"));
      } else {
        toast.error(t("errors.generic"));
      }
    } finally {
      setCompleting(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-medium">{t("runNotFound")}</p>
        <Link href="/checklists">
          <Button variant="outline" size="sm">{t("back")}</Button>
        </Link>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Шапка */}
      <div className="flex items-center gap-3">
        <Link href="/checklists" className="shrink-0">
          <Button variant="ghost" size="icon" aria-label={t("back")}>
            <ArrowLeft className="size-4.5" />
          </Button>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold">{run.templateName}</h2>
            <RunStatusBadge status={run.status} late={run.completedLate} />
            {run.origin === "manual" && (
              <span className="text-xs text-muted-foreground">{t("manualRun")}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDay(run.scheduledAt, locale)} · {formatTime(run.scheduledAt, locale)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CloudUpload className="size-3.5" />
              {t("saving")}
            </span>
          )}
          {remaining !== null && !expired && (
            <span
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium tabular-nums",
                remaining <= 10 ? "text-destructive" : "text-warning"
              )}
            >
              <Timer className="size-4" />
              {t("remaining", { minutes: remaining })}
            </span>
          )}
        </div>
      </div>

      {(expired || run.status === "missed") &&
        run.status !== "completed" &&
        (allowLate && isExecutor ? (
          <div className="rounded-lg border border-warning/40 bg-warning-light/40 px-4 py-3 text-sm text-warning">
            {t("lateNotice")}
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {t("expiredNotice")}
          </div>
        ))}

      {run.photoFreshnessMinutes !== null && editable && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Camera className="size-3.5" />
          {t("freshnessNotice", { minutes: run.photoFreshnessMinutes })}
        </div>
      )}

      {/* Пункты */}
      <div className="flex flex-col gap-3">
        {run.items.map((item, index) => {
          const draft = draftOf(item.id);
          const isViolation = violations.has(item.id);
          const uploading = uploadingItems.has(item.id);
          const showComment = commentOpen.has(item.id) || !!draft.comment;
          return (
            <div
              key={item.id}
              id={`run-item-${item.id}`}
              className={cn(
                "flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors",
                isViolation && "border-destructive ring-1 ring-destructive/40"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {item.title}
                    {item.required && <span className="text-destructive"> *</span>}
                  </span>
                  {item.requirePhoto && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Camera className="size-3.5" />
                      {t("photoRequired")}
                    </span>
                  )}
                </div>
                {editable && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("addComment")}
                    onClick={() =>
                      setCommentOpen((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                    className={cn(
                      "text-muted-foreground",
                      showComment && "text-primary"
                    )}
                  >
                    <MessageSquare className="size-4" />
                  </Button>
                )}
              </div>

              {/* Ввод по типу пункта */}
              {item.type === "checkbox" && (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={draft.value === true}
                    disabled={!editable}
                    onCheckedChange={(v) => setDraft(item.id, { value: v === true })}
                  />
                  {t("checkboxDone")}
                </label>
              )}
              {item.type === "text" && (
                <Textarea
                  value={typeof draft.value === "string" ? draft.value : ""}
                  disabled={!editable}
                  maxLength={2000}
                  rows={2}
                  placeholder={t("textPlaceholder")}
                  onChange={(e) => setDraft(item.id, { value: e.target.value })}
                />
              )}
              {item.type === "number" && (
                <Input
                  type="number"
                  inputMode="decimal"
                  value={typeof draft.value === "number" ? String(draft.value) : ""}
                  disabled={!editable}
                  placeholder="0"
                  onChange={(e) => {
                    const num = e.target.value === "" ? null : Number(e.target.value);
                    if (num === null) setDraft(item.id, { value: null });
                    else if (Number.isFinite(num)) setDraft(item.id, { value: num });
                  }}
                  className="max-w-40 tabular-nums"
                />
              )}
              {item.type === "scale" && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => {
                    const grade = i + 1;
                    const active =
                      typeof draft.value === "number" && grade <= draft.value;
                    return (
                      <button
                        key={grade}
                        type="button"
                        disabled={!editable}
                        aria-label={String(grade)}
                        onClick={() => setDraft(item.id, { value: grade })}
                        className={cn(
                          "transition-transform",
                          editable && "hover:scale-110"
                        )}
                      >
                        <Star
                          className={cn(
                            "size-6",
                            active
                              ? "fill-warning text-warning"
                              : "text-muted-foreground/40"
                          )}
                          strokeWidth={1.75}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Фото (для photo-пунктов и requirePhoto) */}
              {(item.type === "photo" || item.requirePhoto || draft.photos.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {draft.photos.map((photoId) => (
                    <div key={photoId} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- фото из приватного прокси */}
                      <img
                        src={fileUrl(photoId)}
                        alt=""
                        className="size-16 rounded-md border border-border object-cover"
                      />
                      {editable && (
                        <button
                          type="button"
                          aria-label={t("removePhoto")}
                          onClick={() =>
                            setDraft(item.id, {
                              photos: draft.photos.filter((p) => p !== photoId),
                            })
                          }
                          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {editable && draft.photos.length < 5 && (
                    <label className="flex size-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                      {uploading ? (
                        <Spinner className="size-4" />
                      ) : (
                        <Camera className="size-5" strokeWidth={1.75} />
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        multiple
                        hidden
                        disabled={uploading}
                        onChange={(e) => {
                          void addPhotos(item, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Комментарий */}
              {showComment && (
                <Input
                  value={draft.comment}
                  disabled={!editable}
                  maxLength={2000}
                  placeholder={t("commentPlaceholder")}
                  onChange={(e) => setDraft(item.id, { comment: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Завершение */}
      {editable && (
        <Button
          onClick={() => void complete()}
          disabled={completing || saving}
          className="gap-2 self-start"
        >
          {completing ? <Spinner className="size-4" /> : <Check className="size-4" />}
          {t("complete")}
        </Button>
      )}
      {run.status === "completed" && run.completedAt && (
        <p className="text-sm text-muted-foreground">
          {t("completedAt", {
            time: `${formatDay(run.completedAt, locale)} · ${formatTime(run.completedAt, locale)}`,
          })}
        </p>
      )}
    </div>
  );
}
