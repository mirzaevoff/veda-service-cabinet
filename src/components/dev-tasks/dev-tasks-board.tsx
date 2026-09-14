"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ListChecks, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/components/common/current-user-provider";
import {
  ApiError,
  type DevTaskListItem,
  type DevTaskPriority,
  type DevTaskStats,
  type DevTaskStatus,
  type DevTaskType,
} from "@/lib/api";
import { devTasksApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { DevTaskCard } from "./dev-task-card";
import { DevTaskTypesManager } from "./dev-task-types-manager";
import { DevTaskStatusDialog, type StatusDialogMode } from "./dev-task-status-dialog";
import { PRIORITIES, STATUSES, TRANSITIONS } from "./dev-tasks-format";

const ALL = "__all__";

export function DevTasksBoard() {
  const t = useTranslations("DevTasks");
  const tc = useTranslations("Common");
  const router = useRouter();
  const { can } = useCurrentUser();
  const canCreate = can(PERMISSIONS.devTasksCreate);
  const canManage = can(PERMISSIONS.devTasksManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [type, setType] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [area, setArea] = useState("");
  const debouncedArea = useDebouncedValue(area, 400);
  const [mine, setMine] = useState(false);
  const [overdue, setOverdue] = useState(false);

  const [types, setTypes] = useState<DevTaskType[]>([]);
  const [tasks, setTasks] = useState<DevTaskListItem[] | null>(null);
  const [stats, setStats] = useState<DevTaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayed(loading && !tasks);

  // drag-and-drop
  const [dragged, setDragged] = useState<DevTaskListItem | null>(null);
  const [dragOver, setDragOver] = useState<DevTaskStatus | null>(null);
  const [dialogMode, setDialogMode] = useState<StatusDialogMode | null>(null);
  const [dialogTaskId, setDialogTaskId] = useState<string | null>(null);
  const [dialogTarget, setDialogTarget] = useState<DevTaskStatus | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  const typesMap = useMemo(() => new Map(types.map((x) => [x.slug, x])), [types]);

  const loadTypes = useCallback(() => {
    void devTasksApi.types().then(setTypes).catch(() => {});
  }, []);

  useEffect(() => loadTypes(), [loadTypes]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [page, s] = await Promise.all([
        devTasksApi.list({
          limit: 100,
          search: debouncedSearch || undefined,
          type: type === ALL ? undefined : type,
          priority: priority === ALL ? undefined : (priority as DevTaskPriority),
          area: debouncedArea || undefined,
          mine: mine || undefined,
          overdue: overdue || undefined,
        }),
        devTasksApi.stats(),
      ]);
      setTasks(page.items);
      setStats(s);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, type, priority, debouncedArea, mine, overdue]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<DevTaskStatus, DevTaskListItem[]>();
    for (const s of STATUSES) map.set(s, []);
    for (const task of tasks ?? []) map.get(task.status)?.push(task);
    return map;
  }, [tasks]);

  async function applyStatus(
    id: string,
    status: DevTaskStatus,
    payload?: { resolution?: string; shippedVersion?: string }
  ) {
    try {
      await devTasksApi.setStatus(id, { status, ...payload });
      toast.success(t("statusChanged"));
      await load();
      return true;
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (e instanceof ApiError && e.code === "ER2501") toast.error(t("invalidTransition"));
      else if (e instanceof ApiError && e.code === "ER2502") toast.error(t("rejectReasonRequired"));
      else toast.error(t("genericError"));
      return false;
    }
  }

  function handleDrop(target: DevTaskStatus) {
    setDragOver(null);
    const task = dragged;
    setDragged(null);
    if (!task || task.status === target) return;
    if (!TRANSITIONS[task.status].includes(target)) {
      toast.error(t("invalidTransition"));
      return;
    }
    if (target === "rejected" || target === "done") {
      setDialogTaskId(task.id);
      setDialogTarget(target);
      setDialogMode(target === "rejected" ? "reject" : "done");
      return;
    }
    void applyStatus(task.id, target);
  }

  async function confirmDialog(payload: { resolution?: string; shippedVersion?: string }) {
    if (!dialogTaskId || !dialogTarget) return;
    setDialogBusy(true);
    const ok = await applyStatus(dialogTaskId, dialogTarget, payload);
    setDialogBusy(false);
    if (ok) {
      setDialogMode(null);
      setDialogTaskId(null);
      setDialogTarget(null);
    }
  }

  const hasFilters =
    !!debouncedSearch ||
    type !== ALL ||
    priority !== ALL ||
    !!debouncedArea ||
    mine ||
    overdue;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="w-56 pl-9"
          />
        </div>

        {types.length > 0 && (
          <Select
            value={type}
            items={{
              [ALL]: t("allTypes"),
              ...Object.fromEntries(types.map((x) => [x.slug, x.name])),
            }}
            onValueChange={(v) => setType(v ?? ALL)}
          >
            <SelectTrigger className="h-9 w-auto min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-40">
              <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
              {types.map((x) => (
                <SelectItem key={x.slug} value={x.slug}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={priority}
          items={{
            [ALL]: t("allPriorities"),
            ...Object.fromEntries(PRIORITIES.map((p) => [p, t(`priority.${p}`)])),
          }}
          onValueChange={(v) => setPriority(v ?? ALL)}
        >
          <SelectTrigger className="h-9 w-auto min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-40">
            <SelectItem value={ALL}>{t("allPriorities")}</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`priority.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder={t("areaFilter")}
          className="w-40"
        />

        <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mine} onCheckedChange={setMine} />
          {t("mineOnly")}
        </label>
        <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={overdue} onCheckedChange={setOverdue} />
          {t("overdueOnly")}
        </label>

        <div className="ms-auto flex items-center gap-2">
          {canManage && <DevTaskTypesManager onChange={loadTypes} />}
          {canCreate && (
            <Button onClick={() => router.push("/dev-tasks/new")} className="gap-2">
              <Plus className="size-4" />
              {t("create")}
            </Button>
          )}
        </div>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-muted-foreground">
            {t("statsTotal")}: <span className="font-semibold text-foreground">{stats.total}</span>
          </span>
          <span className="text-muted-foreground">
            {t("statsOpen")}: <span className="font-semibold text-foreground">{stats.open}</span>
          </span>
          <span className="text-muted-foreground">
            {t("statsOverdue")}:{" "}
            <span
              className={cn(
                "font-semibold",
                stats.overdue > 0 ? "text-destructive" : "text-foreground"
              )}
            >
              {stats.overdue}
            </span>
          </span>
        </div>
      )}

      {loading && !tasks ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {showSkeleton &&
            STATUSES.map((s) => (
              <div key={s} className="flex w-72 shrink-0 flex-col gap-2">
                <Skeleton className="h-8 rounded-md" />
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </div>
            ))}
        </div>
      ) : !tasks || (tasks.length === 0 && !hasFilters) ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <ListChecks className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          {canCreate && (
            <>
              <p className="-mt-2 text-xs text-muted-foreground">{t("emptyHint")}</p>
              <Button
                onClick={() => router.push("/dev-tasks/new")}
                variant="outline"
                className="gap-2"
              >
                <Plus className="size-4" />
                {t("create")}
              </Button>
            </>
          )}
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{tc("nothingFound")}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STATUSES.map((status) => {
            const items = grouped.get(status) ?? [];
            const count = stats?.byStatus?.[status] ?? items.length;
            const isDropTarget =
              canManage &&
              !!dragged &&
              dragged.status !== status &&
              TRANSITIONS[dragged.status].includes(status);
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  if (!canManage || !dragged) return;
                  if (!TRANSITIONS[dragged.status].includes(status)) return;
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((cur) => (cur === status ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(status);
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col gap-2 rounded-lg border p-2 transition-colors",
                  dragOver === status
                    ? "border-primary/50 bg-accent-light"
                    : isDropTarget
                      ? "border-dashed border-primary/30"
                      : "border-border bg-secondary/30"
                )}
              >
                <div className="flex items-center justify-between px-1 py-0.5">
                  <span className="text-sm font-semibold">{t(`status.${status}`)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                      {t("emptyColumn")}
                    </p>
                  ) : (
                    items.map((task) => (
                      <DevTaskCard
                        key={task.id}
                        task={task}
                        types={typesMap}
                        draggable={canManage}
                        onDragStart={(x) => setDragged(x)}
                        onDragEnd={() => setDragged(null)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DevTaskStatusDialog
        mode={dialogMode}
        open={dialogMode !== null}
        busy={dialogBusy}
        onOpenChange={(v) => {
          if (!v) {
            setDialogMode(null);
            setDialogTaskId(null);
            setDialogTarget(null);
          }
        }}
        onConfirm={(payload) => void confirmDialog(payload)}
      />
    </div>
  );
}
