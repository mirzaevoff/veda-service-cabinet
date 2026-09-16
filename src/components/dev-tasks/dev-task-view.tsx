"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  History,
  Pencil,
  Send,
  Trash2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/common/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { UserPicker } from "@/components/common/user-picker";
import {
  useAttachments,
  AttachmentList,
  AttachmentPicker,
} from "@/components/tickets/attachment-uploader";
import { AttachmentView } from "@/components/tickets/chat/attachment-view";
import { uploadDevTaskFile } from "@/lib/upload";
import {
  ApiError,
  type DevTaskComment,
  type DevTaskDetail,
  type DevTaskPriority,
  type DevTaskStatus,
  type DevTaskType,
  type DevTaskUserRef,
} from "@/lib/api";
import { devTasksApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDateOnly, formatRelativeTime, formatTashkentDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/i18n/navigation";
import { DevTaskTypeBadge } from "./dev-task-type-badge";
import { DevTaskStatusDialog, type StatusDialogMode } from "./dev-task-status-dialog";
import {
  isOverdue,
  parseStatusLog,
  PRIORITIES,
  priorityStyle,
  statusStyle,
  toDateInput,
  TRANSITIONS,
} from "./dev-tasks-format";

export function DevTaskView({ id }: { id: string }) {
  const t = useTranslations("DevTasks");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useCurrentUser();
  const canManage = can(PERMISSIONS.devTasksManage);
  const canCreate = can(PERMISSIONS.devTasksCreate);

  const [task, setTask] = useState<DevTaskDetail | null>(null);
  const [types, setTypes] = useState<DevTaskType[]>([]);
  const [comments, setComments] = useState<DevTaskComment[] | null>(null);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const attach = useAttachments(uploadDevTaskFile);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // status dialog (reject/done)
  const [dialogMode, setDialogMode] = useState<StatusDialogMode | null>(null);
  const [dialogTarget, setDialogTarget] = useState<DevTaskStatus | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  // assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignee, setAssignee] = useState<DevTaskUserRef | null>(null);
  const [plannedDue, setPlannedDue] = useState("");
  const [assignPriority, setAssignPriority] = useState<DevTaskPriority>("normal");
  const [assignBusy, setAssignBusy] = useState(false);

  const typesMap = useMemo(() => new Map(types.map((x) => [x.slug, x])), [types]);

  useEffect(() => {
    void devTasksApi.types().then(setTypes).catch(() => {});
  }, []);

  const load = useCallback(() => {
    devTasksApi
      .get(id)
      .then(setTask)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else if (e instanceof ApiError && e.code === "ER2500") router.replace("/dev-tasks");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadComments = useCallback(() => {
    devTasksApi
      .comments(id)
      .then(setComments)
      .catch(() => setComments([]));
  }, [id]);

  useEffect(() => load(), [load]);
  useEffect(() => loadComments(), [loadComments]);

  function handleError(e: unknown) {
    if (e instanceof SessionExpiredError) {
      router.replace("/login");
      return;
    }
    if (e instanceof ApiError) {
      if (e.code === "ER2501") return void toast.error(t("invalidTransition"));
      if (e.code === "ER2502") return void toast.error(t("rejectReasonRequired"));
      if (e.code === "ER2500") return void router.replace("/dev-tasks");
    }
    toast.error(t("genericError"));
  }

  async function changeStatus(
    status: DevTaskStatus,
    payload?: { resolution?: string; shippedVersion?: string }
  ) {
    setBusy(true);
    try {
      setTask(await devTasksApi.setStatus(id, { status, ...payload }));
      toast.success(t("statusChanged"));
      return true;
    } catch (e) {
      handleError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function onTransition(target: DevTaskStatus) {
    if (target === "rejected" || target === "done") {
      setDialogTarget(target);
      setDialogMode(target === "rejected" ? "reject" : "done");
      return;
    }
    void changeStatus(target);
  }

  async function confirmDialog(payload: { resolution?: string; shippedVersion?: string }) {
    if (!dialogTarget) return;
    setDialogBusy(true);
    const ok = await changeStatus(dialogTarget, payload);
    setDialogBusy(false);
    if (ok) {
      setDialogMode(null);
      setDialogTarget(null);
    }
  }

  function openAssign() {
    if (!task) return;
    setAssignee(task.assignee);
    setPlannedDue(toDateInput(task.plannedDueDate));
    setAssignPriority(task.priority);
    setAssignOpen(true);
  }

  async function saveAssign() {
    setAssignBusy(true);
    try {
      const saved = await devTasksApi.update(id, {
        assigneeId: assignee?.id ?? null,
        plannedDueDate: plannedDue || null,
        priority: assignPriority,
      });
      setTask(saved);
      toast.success(t("saved"));
      setAssignOpen(false);
    } catch (e) {
      handleError(e);
    } finally {
      setAssignBusy(false);
    }
  }

  async function sendComment() {
    const text = commentText.trim();
    const ids = attach.attachmentIds;
    if (!text && ids.length === 0) return;
    if (attach.uploading) return;
    setSending(true);
    try {
      await devTasksApi.addComment(id, {
        text: text || undefined,
        attachmentIds: ids.length ? ids : undefined,
      });
      setCommentText("");
      attach.clear();
      toast.success(t("commentAdded"));
      loadComments();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("genericError"));
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    try {
      await devTasksApi.remove(id);
      toast.success(t("deleted"));
      router.replace("/dev-tasks");
    } catch (e) {
      handleError(e);
    }
  }

  if (!task) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const isAuthor = !!user && task.author?.id === user.id;
  const showEdit = canManage || (isAuthor && task.status === "new" && canCreate);
  const transitions = canManage ? TRANSITIONS[task.status] : [];
  const desiredOverdue = isOverdue(task.desiredDueDate, task.status);
  const plannedOverdue = isOverdue(task.plannedDueDate, task.status);
  const showResolution =
    (task.status === "done" || task.status === "rejected") && !!task.resolution;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        href="/dev-tasks"
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <DevTaskTypeBadge slug={task.type} types={typesMap} />
            <Badge variant="secondary" className={priorityStyle(task.priority)}>
              {t(`priority.${task.priority}`)}
            </Badge>
            <Badge variant="secondary" className={statusStyle(task.status)}>
              {t(`status.${task.status}`)}
            </Badge>
            {task.area && (
              <span className="text-xs text-muted-foreground">{task.area}</span>
            )}
            {task.tags.map((x) => (
              <span
                key={x}
                className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                #{x}
              </span>
            ))}
          </div>
        </div>

        {(showEdit || canManage) && (
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openAssign}>
                <UserCog className="size-4" />
                {t("assignTitle")}
              </Button>
            )}
            {showEdit && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => router.push(`/dev-tasks/${id}/edit`)}
              >
                <Pencil className="size-4" />
                {t("edit")}
              </Button>
            )}
            {canManage && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("delete")}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {transitions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {transitions.map((target) => (
            <Button
              key={target}
              size="sm"
              variant={target === "rejected" ? "outline" : "default"}
              disabled={busy}
              className={cn(
                "gap-1.5",
                target === "rejected" && "text-destructive hover:text-destructive"
              )}
              onClick={() => onTransition(target)}
            >
              {t(`transition.${target}`)}
            </Button>
          ))}
        </div>
      )}

      <section className="grid gap-x-6 gap-y-2 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t("authorLabel")}</span>
          <span>
            {task.author?.name ?? "—"}
            {task.team && (
              <span className="text-muted-foreground"> · {task.team}</span>
            )}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t("assigneeLabel")}</span>
          <span>{task.assignee ? task.assignee.name : t("noAssignee")}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t("desiredDue")}</span>
          <span className={cn(desiredOverdue && "text-destructive")}>
            {task.desiredDueDate
              ? formatDateOnly(task.desiredDueDate.slice(0, 10), locale)
              : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t("plannedDue")}</span>
          <span className={cn(plannedOverdue && "text-destructive")}>
            {task.plannedDueDate
              ? formatDateOnly(task.plannedDueDate.slice(0, 10), locale)
              : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">
            {t("createdAt", { date: formatTashkentDateTime(task.createdAt, locale) })}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("updatedAt", { date: formatRelativeTime(task.updatedAt, locale) })}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("descriptionTitle")}
        </span>
        {task.description ? (
          <p className="whitespace-pre-wrap text-sm">{task.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
        )}
      </section>

      {task.attachments.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("attachments")}
          </span>
          <AttachmentView attachments={task.attachments} />
        </section>
      )}

      {showResolution && (
        <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("resolutionLabel")}
          </span>
          <p className="whitespace-pre-wrap text-sm">{task.resolution}</p>
          {task.shippedVersion && (
            <p className="text-xs text-muted-foreground">
              {t("shippedVersionLabel")}: {task.shippedVersion}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <Send className="size-4 text-muted-foreground" />
          <span className="font-medium">{t("commentsTitle")}</span>
        </div>
        {comments === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t("noComments")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <li key={c.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{c.author?.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(c.createdAt, locale)}
                  </span>
                </div>
                {c.text && <p className="whitespace-pre-wrap text-sm">{c.text}</p>}
                {c.attachments.length > 0 && (
                  <AttachmentView attachments={c.attachments} className="mt-0.5" />
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2">
          <AttachmentList
            items={attach.items}
            onRemove={attach.remove}
            onRetry={attach.retry}
          />
          <div className="flex items-end gap-2">
            <AttachmentPicker
              variant="ghost"
              onPick={attach.add}
              disabled={sending || attach.items.length >= 10}
            />
            <Textarea
              rows={2}
              value={commentText}
              maxLength={4000}
              placeholder={t("commentPlaceholder")}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void sendComment();
                }
              }}
            />
            <Button
              size="sm"
              className="gap-1.5"
              disabled={
                sending ||
                attach.uploading ||
                (!commentText.trim() && attach.attachmentIds.length === 0)
              }
              onClick={() => void sendComment()}
            >
              {sending ? <Spinner className="size-4" /> : <Send className="size-4" />}
              {t("send")}
            </Button>
          </div>
        </div>
      </section>

      {task.log.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <span className="font-medium">{t("logTitle")}</span>
          </div>
          <ul className="flex flex-col gap-3">
            {task.log.map((entry, i) => {
              const parsed = parseStatusLog(entry.action);
              const text = parsed
                ? t("log.status", {
                    from: t(`status.${parsed.from}`),
                    to: t(`status.${parsed.to}`),
                  })
                : ["created", "edited", "assigned"].includes(entry.action)
                  ? t(`log.${entry.action}`)
                  : t("log.unknown");
              return (
                <li key={i} className="flex gap-3 text-sm">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-border" />
                  <div className="flex min-w-0 flex-col">
                    <span>{text}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.user && `${entry.user.name} · `}
                      {formatTashkentDateTime(entry.at, locale)}
                    </span>
                    {entry.note && (
                      <span className="text-xs text-muted-foreground">{entry.note}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <DevTaskStatusDialog
        mode={dialogMode}
        open={dialogMode !== null}
        busy={dialogBusy}
        onOpenChange={(v) => {
          if (!v) {
            setDialogMode(null);
            setDialogTarget(null);
          }
        }}
        onConfirm={(payload) => void confirmDialog(payload)}
      />

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("assignTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("assigneeField")}</Label>
              <UserPicker value={assignee} onChange={setAssignee} placeholder={t("noAssignee")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("plannedDueField")}</Label>
              <DatePicker future value={plannedDue} onChange={setPlannedDue} placeholder="—" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("priorityField")}</Label>
              <Select
                value={assignPriority}
                items={Object.fromEntries(PRIORITIES.map((p) => [p, t(`priority.${p}`)]))}
                onValueChange={(v) => setAssignPriority((v ?? "normal") as DevTaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-auto min-w-40">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`priority.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={assignBusy} onClick={() => void saveAssign()}>
              {assignBusy ? <Spinner className="size-4" /> : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void remove()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
