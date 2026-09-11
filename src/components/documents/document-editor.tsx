"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, Paperclip, Plus, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { BlockEditor, type BlockEditorHandle } from "@/components/knowledge/editor/block-editor";
import {
  ApiError,
  type DocumentAudience,
  type DocumentType,
  type DocumentUserRef,
  type EditorJsData,
  type FileAttachment,
  type UserProfile,
} from "@/lib/api";
import { adminApi, documentsApi, SessionExpiredError } from "@/lib/api-authed";
import {
  formatBytes,
  MAX_ATTACHMENTS,
  UPLOAD_ACCEPT,
  uploadDocumentFile,
  uploadDocumentImage,
} from "@/lib/upload";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/i18n/navigation";

/** Мультивыбор адресатов: поиск + добавление; уже выбранные исключаются */
function RecipientsPicker({
  selectedIds,
  onAdd,
}: {
  selectedIds: string[];
  onAdd: (user: DocumentUserRef) => void;
}) {
  const t = useTranslations("Documents");
  const tc = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);
  const [options, setOptions] = useState<UserProfile[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void adminApi.users
      .list({ search: debounced || undefined, status: "active", limit: 15 })
      .then((p) => !cancelled && setOptions(p.items))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  const visible = options?.filter((u) => !selectedIds.includes(u.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 self-start font-normal">
            <UserPlus className="size-4" />
            {t("addRecipient")}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-72 p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tc("search")}
            className="h-8 pl-8"
          />
        </div>
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          {visible?.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onAdd({ id: u.id, name: [u.name, u.lastName].filter(Boolean).join(" ") });
                setQ("");
              }}
              className="flex flex-col rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span className="font-medium">{[u.name, u.lastName].filter(Boolean).join(" ")}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{u.phone}</span>
            </button>
          ))}
          {visible && visible.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {tc("nothingFound")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Редактор документа. documentId=null — создание */
export function DocumentEditor({ documentId }: { documentId: string | null }) {
  const t = useTranslations("Documents");
  const tc = useTranslations("Common");
  const router = useRouter();
  const { can, loading: userLoading } = useCurrentUser();

  const [loaded, setLoaded] = useState(documentId === null);
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [audience, setAudience] = useState<DocumentAudience>("all");
  const [visibleTo, setVisibleTo] = useState<DocumentUserRef[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [initialContent, setInitialContent] = useState<EditorJsData | undefined>();
  const [needsReset, setNeedsReset] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<BlockEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void documentsApi.types().then(setTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!documentId) return;
    documentsApi
      .get(documentId)
      .then((d) => {
        setTitle(d.title);
        setTypeId(d.type?.id ?? "");
        setTags(d.tags);
        setAudience(d.audience);
        setVisibleTo(d.visibleTo);
        setAttachments(d.attachments);
        setInitialContent(d.content);
        setNeedsReset(d.status === "pending" || d.status === "active");
        setLoaded(true);
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

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
        const uploaded = await uploadDocumentFile(file);
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
    if (!typeId) {
      toast.error(t("typeRequired"));
      return;
    }
    setSaving(true);
    try {
      const content = (await editorRef.current?.save()) ?? { blocks: [] };
      const payload = {
        title: title.trim(),
        content,
        typeId,
        tags,
        attachmentIds: attachments.map((a) => a.id),
        audience,
        visibleTo: audience === "specific" ? visibleTo.map((v) => v.id) : undefined,
      };
      const saved = documentId
        ? await documentsApi.update(documentId, payload)
        : await documentsApi.create(payload);
      toast.success(documentId ? t("saved") : t("createdDraft"));
      router.replace(`/documents/${saved.id}`);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (e instanceof ApiError && e.code === "ER2301") toast.error(t("bodyTooBig"));
      else toast.error(t("genericError"));
      setSaving(false);
    }
  }

  if (!userLoading && !can(PERMISSIONS.documentsManage)) {
    router.replace("/documents");
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

  const backHref = documentId ? `/documents/${documentId}` : "/documents";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href={backHref}
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tc("cancel")}
      </Link>

      <h1 className="text-xl font-bold">{documentId ? t("editTitle") : t("createTitle")}</h1>

      {needsReset && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-light px-3 py-2.5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{t("resetWarning")}</span>
        </div>
      )}

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
          <Label className="text-sm font-medium text-muted-foreground">{t("typeLabel")}</Label>
          <Select
            value={typeId}
            items={Object.fromEntries(types.map((x) => [x.id, x.name]))}
            onValueChange={(v) => setTypeId(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("typeRequired")} />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-44">
              {types.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-muted-foreground">{t("tagsLabel")}</Label>
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
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === "," || e.key === " ") && tagInput.trim()) {
                  e.preventDefault();
                  addTag(tagInput);
                }
                if (e.key === "Backspace" && !tagInput && tags.length)
                  setTags((p) => p.slice(0, -1));
              }}
              onBlur={() => tagInput.trim() && addTag(tagInput)}
              className="min-w-16 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("visibleToLabel")}</Label>
        <div className="inline-flex self-start rounded-lg border border-border p-0.5">
          {(["all", "specific"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAudience(a)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                audience === a
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {a === "all" ? t("audienceAll") : t("audienceSpecific")}
            </button>
          ))}
        </div>
        {audience === "specific" && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">{t("visibleToHint")}</span>
            {visibleTo.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {visibleTo.map((u) => (
                  <span
                    key={u.id}
                    className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs"
                  >
                    {u.name}
                    <button
                      type="button"
                      onClick={() => setVisibleTo((p) => p.filter((v) => v.id !== u.id))}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <RecipientsPicker
              selectedIds={visibleTo.map((v) => v.id)}
              onAdd={(u) => setVisibleTo((p) => (p.some((v) => v.id === u.id) ? p : [...p, u]))}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("attachmentsLabel")}</Label>
        {attachments.length > 0 && (
          <div className="flex flex-col gap-1">
            {attachments.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.originalName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(f.size)}
                </span>
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

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("body")}</Label>
        <div className="min-h-64 rounded-lg border border-border px-3 py-3 focus-within:border-primary/40">
          <BlockEditor ref={editorRef} initialData={initialContent} uploadImage={uploadDocumentImage} />
        </div>
        <span className="text-xs text-muted-foreground">{t("editorHint")}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(backHref)}>
          {tc("cancel")}
        </Button>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? <Spinner className="size-4" /> : documentId ? t("saveChanges") : t("saveDraft")}
        </Button>
      </div>
    </div>
  );
}
