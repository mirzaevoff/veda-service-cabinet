"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardList, Play, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { SortSelect } from "@/components/common/sort-select";
import type { SortValue } from "@/components/common/sortable-table-head";
import { RunStatusBadge } from "./run-status-badge";
import type { ChecklistRun, ChecklistTemplate, LegalEntity } from "@/lib/api";
import { checklistsApi, legalEntitiesApi } from "@/lib/api-authed";
import { formatRelativeTime } from "@/lib/format";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** «Осталось N мин» с тиком раз в 30 сек; null — дедлайна нет */
export function useRemainingMinutes(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const compute = () =>
      expiresAt
        ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60_000))
        : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация таймера с дедлайном
    setRemaining(compute());
    if (!expiresAt) return;
    const id = setInterval(() => setRemaining(compute()), 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

function RunCard({ run, index }: { run: ChecklistRun; index: number }) {
  const t = useTranslations("Checklists");
  const locale = useLocale();
  const remaining = useRemainingMinutes(
    run.status === "pending" || run.status === "in_progress" ? run.expiresAt : null
  );

  const answered = new Set(
    run.answers
      .filter((a) => a.value !== null || a.photos.length > 0)
      .map((a) => a.item)
  ).size;

  return (
    <Link
      href={`/checklists/runs/${run.id}`}
      className="duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <Card
        className={cn(
          "flex-row items-center gap-4 rounded-lg border-border p-4 transition-colors hover:border-primary/40",
          (run.status === "completed" ||
            run.status === "missed" ||
            run.status === "cancelled") &&
            "opacity-70"
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light">
          <ClipboardList className="size-5 text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{run.templateName}</span>
            <RunStatusBadge status={run.status} late={run.completedLate} />
            {run.origin === "manual" && (
              <span className="text-xs text-muted-foreground">
                {t("manualRun")}
              </span>
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {formatRelativeTime(run.scheduledAt, locale)}
            {run.items.length > 0 && ` · ${answered}/${run.items.length}`}
          </span>
        </div>
        {remaining !== null && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 text-sm font-medium tabular-nums",
              remaining <= 10 ? "text-destructive" : "text-warning"
            )}
          >
            <Timer className="size-4" />
            {t("remaining", { minutes: remaining })}
          </span>
        )}
      </Card>
    </Link>
  );
}

/** «Мои задания»: активные / история + ручной запуск */
export function RunsList() {
  const t = useTranslations("Checklists");
  const router = useRouter();

  const [tab, setTab] = useState<"active" | "history">("active");
  const [sort, setSort] = useState<SortValue>("scheduledAt:desc");
  const [runs, setRuns] = useState<ChecklistRun[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [choices, setChoices] = useState<
    { template: ChecklistTemplate; entity: LegalEntity | null }[] | null
  >(null);
  const [starting, setStarting] = useState<string | null>(null);

  const reload = useCallback(() => {
    checklistsApi.runs
      .list({ sort, limit: 50 })
      .then((page) => setRuns(page.items))
      .catch(() => setRuns([]));
  }, [sort]);

  useEffect(reload, [reload]);

  async function openPicker() {
    setPickerOpen(true);
    if (choices) return;
    try {
      const [personal, entities] = await Promise.all([
        checklistsApi.templates.list({ limit: 50 }),
        legalEntitiesApi.my(),
      ]);
      const perEntity = await Promise.all(
        entities.map((entity) =>
          checklistsApi.templates
            .list({ entity: entity.id, limit: 50 })
            .then((page) =>
              page.items.map((template) => ({ template, entity }))
            )
            .catch(() => [])
        )
      );
      setChoices([
        ...personal.items.map((template) => ({ template, entity: null })),
        ...perEntity.flat(),
      ]);
    } catch {
      setChoices([]);
    }
  }

  async function start(templateId: string) {
    setStarting(templateId);
    try {
      const run = await checklistsApi.runs.createManual(templateId);
      router.push(`/checklists/runs/${run.id}`);
    } catch {
      toast.error(t("errors.generic"));
      setStarting(null);
    }
  }

  const filtered = (runs ?? []).filter((run) =>
    tab === "active"
      ? run.status === "pending" || run.status === "in_progress"
      : run.status !== "pending" && run.status !== "in_progress"
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
          {(["active", "history"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                tab === key
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(key === "active" ? "tabActive" : "tabHistory")}
            </button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <SortSelect
            value={sort}
            options={[
              { value: "scheduledAt:desc", label: t("sortNewest") },
              { value: "scheduledAt:asc", label: t("sortOldest") },
              { value: "completedAt:desc", label: t("sortCompleted") },
            ]}
            onChange={setSort}
            className="w-48"
          />
          <Button onClick={openPicker} className="gap-2">
            <Play className="size-4" />
            {t("startManual")}
          </Button>
        </div>
      </div>

      {!runs ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <ClipboardList className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-medium">{t("runsEmptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("runsEmptyHint")}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((run, i) => (
            <RunCard key={run.id} run={run} index={i} />
          ))}
        </div>
      )}

      {/* Выбор шаблона для ручного запуска */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("startManual")}</DialogTitle>
            <DialogDescription>{t("startManualHint")}</DialogDescription>
          </DialogHeader>
          {!choices ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          ) : choices.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {t("noTemplates")}
            </p>
          ) : (
            <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {choices.map(({ template, entity }) => (
                <button
                  key={template.id}
                  type="button"
                  disabled={!!starting}
                  onClick={() => start(template.id)}
                  className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-primary/40"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {template.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {entity
                        ? entity.establishment || entity.name
                        : t("personalTemplate")}
                    </span>
                  </div>
                  {starting === template.id && <Spinner className="size-4" />}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
