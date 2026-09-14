"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, Paperclip, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ApiError,
  type CreateDevTaskInput,
  type DevTaskPriority,
  type DevTaskType,
  type DevTaskUserRef,
  type FileAttachment,
  type UpdateDevTaskInput,
} from "@/lib/api";
import { devTasksApi, SessionExpiredError } from "@/lib/api-authed";
import { formatBytes, MAX_ATTACHMENTS, UPLOAD_ACCEPT, uploadDevTaskFile } from "@/lib/upload";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { PRIORITIES, toDateInput } from "./dev-tasks-format";

const NONE = "__none__";

/** Редактор задачи. taskId=null — создание */
export function DevTaskEditor({ taskId }: { taskId: string | null }) {
  const t = useTranslations("DevTasks");
  const tc = useTranslations("Common");
  const router = useRouter();
  const { can, user, loading: userLoading } = useCurrentUser();
  const canManage = can(PERMISSIONS.devTasksManage);
  const canCreate = can(PERMISSIONS.devTasksCreate);

  const [loaded, setLoaded] = useState(taskId === null);
  const [blocked, setBlocked] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState(NONE);
  const [types, setTypes] = useState<DevTaskType[]>([]);
  const [priority, setPriority] = useState<DevTaskPriority>("normal");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [desiredDue, setDesiredDue] = useState("");
  const [assignee, setAssignee] = useState<DevTaskUserRef | null>(null);
  const [plannedDue, setPlannedDue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void devTasksApi.types().then(setTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!taskId) return;
    devTasksApi
      .get(taskId)
      .then((d) => {
        setTitle(d.title);
        setType(d.type ?? NONE);
        setPriority(d.priority);
        setArea(d.area ?? "");
        setDescription(d.description ?? "");
        setTags(d.tags);
        setAttachments(d.attachments);
        setDesiredDue(toDateInput(d.desiredDueDate));
        setAssignee(d.assignee);
        setPlannedDue(toDateInput(d.plannedDueDate));
        // автор может править только new; менеджер — всегда
        const isAuthor = !!user && d.author?.id === user.id;
        const mayEdit = can(PERMISSIONS.devTasksManage) || (isAuthor && d.status === "new");
        setBlocked(!mayEdit);
        setLoaded(true);
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else if (e instanceof ApiError && e.code === "ER2500") router.replace("/dev-tasks");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, user]);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 30) setTags((p) => [...p, tag]);
    setTagInput("");
  }

  async function onFiles(list: FileList) {
    const files = Array.from(list);
    setUploading(true);
    let count = attachments.length;
    for (const file of files) {
      if (count >= MAX_ATTACHMENTS) break;
      try {
        const uploaded = await uploadDevTaskFile(file);
        count++;
        setAttachments((p) => [...p, uploaded]);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          router.replace("/login");
          break;
        }
        toast.error(t("genericError"));
      }
    }
    setUploading(false);
  }

  async function save() {
    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const attachmentIds = attachments.map((a) => a.id);
      if (taskId) {
        const payload: UpdateDevTaskInput = {
          title: title.trim(),
          type: type === NONE ? undefined : type,
          area: area.trim() || undefined,
          description: description.trim() || undefined,
          priority,
          tags,
          attachmentIds,
          desiredDueDate: desiredDue || undefined,
        };
        if (canManage) {
          payload.assigneeId = assignee?.id ?? null;
          payload.plannedDueDate = plannedDue || null;
          payload.priority = priority;
        }
        const saved = await devTasksApi.update(taskId, payload);
        toast.success(t("saved"));
        router.replace(`/dev-tasks/${saved.id}`);
      } else {
        const payload: CreateDevTaskInput = {
          title: title.trim(),
          type: type === NONE ? undefined : type,
          area: area.trim() || undefined,
          description: description.trim() || undefined,
          priority,
          tags,
          attachmentIds,
          desiredDueDate: desiredDue || undefined,
        };
        const saved = await devTasksApi.create(payload);
        toast.success(t("created"));
        router.replace(`/dev-tasks/${saved.id}`);
      }
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (e instanceof ApiError && e.code === "ER2503") toast.error(t("editNewOnly"));
      else if (e instanceof ApiError && e.code === "ER2504") toast.error(t("typeInvalid"));
      else toast.error(t("genericError"));
      setSaving(false);
    }
  }

  // Гейтинг создания: нужно право devTasks.create
  if (!userLoading && !taskId && !canCreate) {
    router.replace("/dev-tasks");
    return null;
  }

  if (!loaded) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const backHref = taskId ? `/dev-tasks/${taskId}` : "/dev-tasks";
  const activeTypes = types.filter((x) => x.active || x.slug === type);

  if (blocked) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {tc("cancel")}
        </Link>
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-light px-3 py-2.5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{t("editNewOnly")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href={backHref}
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tc("cancel")}
      </Link>

      <h1 className="text-xl font-bold">{taskId ? t("editTitle") : t("createTitle")}</h1>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("titleLabel")}</Label>
        <Input
          value={title}
          maxLength={300}
          placeholder={t("titlePlaceholder")}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-muted-foreground">{t("typeField")}</Label>
          <Select
            value={type}
            items={{
              [NONE]: "—",
              ...Object.fromEntries(activeTypes.map((x) => [x.slug, x.name])),
            }}
            onValueChange={(v) => setType(v ?? NONE)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-44">
              <SelectItem value={NONE}>—</SelectItem>
              {activeTypes.map((x) => (
                <SelectItem key={x.slug} value={x.slug}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-muted-foreground">{t("priorityField")}</Label>
          <Select
            value={priority}
            items={Object.fromEntries(PRIORITIES.map((p) => [p, t(`priority.${p}`)]))}
            onValueChange={(v) => setPriority((v ?? "normal") as DevTaskPriority)}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-muted-foreground">{t("areaField")}</Label>
          <Input
            value={area}
            maxLength={100}
            placeholder={t("areaPlaceholder")}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-muted-foreground">{t("desiredDueField")}</Label>
          <DatePicker future value={desiredDue} onChange={setDesiredDue} placeholder="—" />
        </div>
      </div>

      {canManage && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">{t("assigneeField")}</Label>
            <UserPicker value={assignee} onChange={setAssignee} placeholder={t("noAssignee")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">{t("plannedDueField")}</Label>
            <DatePicker future value={plannedDue} onChange={setPlannedDue} placeholder="—" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("descriptionField")}</Label>
        <Textarea
          rows={6}
          value={description}
          maxLength={20000}
          placeholder={t("descriptionPlaceholder")}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("tags")}</Label>
        <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-border px-2 py-1">
          {tags.map((x) => (
            <span
              key={x}
              className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              #{x}
              <button type="button" onClick={() => setTags((p) => p.filter((v) => v !== x))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder={t("tagsPlaceholder")}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === "," || e.key === " ") && tagInput.trim()) {
                e.preventDefault();
                addTag(tagInput);
              }
              if (e.key === "Backspace" && !tagInput && tags.length) setTags((p) => p.slice(0, -1));
            }}
            onBlur={() => tagInput.trim() && addTag(tagInput)}
            className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("attachmentsField")}</Label>
        {attachments.length > 0 && (
          <div className="flex flex-col gap-1">
            {attachments.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.originalName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  aria-label={tc("delete")}
                  className="ms-auto shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setAttachments((p) => p.filter((x) => x.id !== f.id))}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 self-start"
          disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Spinner className="size-4" /> : <Plus className="size-4" />}
          {uploading ? t("uploading") : t("addFile")}
        </Button>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(backHref)}>
          {tc("cancel")}
        </Button>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? <Spinner className="size-4" /> : taskId ? t("saveChanges") : t("saveDraft")}
        </Button>
      </div>
    </div>
  );
}
