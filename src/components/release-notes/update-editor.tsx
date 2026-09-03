"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { BlockEditor, type BlockEditorHandle } from "@/components/knowledge/editor/block-editor";
import {
  ApiError,
  type EditorJsData,
  type ReleaseArea,
  type ReleaseAudience,
  type ReleaseNote,
} from "@/lib/api";
import { releaseNotesApi, SessionExpiredError } from "@/lib/api-authed";
import { uploadReleaseNoteImage } from "@/lib/upload";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { version as frontVersionDefault } from "../../../package.json";

export function UpdateEditor({ noteId }: { noteId: string | null }) {
  const t = useTranslations("Updates");
  const tc = useTranslations("Common");
  const router = useRouter();
  const { can, loading: userLoading } = useCurrentUser();

  const [loaded, setLoaded] = useState(noteId === null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [area, setArea] = useState<ReleaseArea>("frontend");
  const [frontVersion, setFrontVersion] = useState(noteId ? "" : frontVersionDefault);
  const [apiVersion, setApiVersion] = useState("");
  const [audience, setAudience] = useState<ReleaseAudience>("staff");
  const [pinned, setPinned] = useState(false);
  const [important, setImportant] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [initialContent, setInitialContent] = useState<EditorJsData | undefined>();
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<BlockEditorHandle>(null);

  useEffect(() => {
    if (!noteId) return;
    releaseNotesApi
      .get(noteId)
      .then((n: ReleaseNote) => {
        setTitle(n.title);
        setSummary(n.summary);
        setArea(n.area);
        setFrontVersion(n.frontVersion);
        setApiVersion(n.apiVersion);
        setAudience(n.audience);
        setPinned(n.pinned);
        setImportant(n.important);
        setTags(n.tags);
        setInitialContent(n.content);
        setLoaded(true);
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 30) setTags((p) => [...p, tag]);
    setTagInput("");
  }

  async function save() {
    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const content = (await editorRef.current?.save()) ?? { blocks: [] };
      const payload = {
        title: title.trim(),
        summary: summary.trim(),
        content,
        area,
        frontVersion: frontVersion.trim(),
        apiVersion: apiVersion.trim(),
        audience,
        pinned,
        important,
        tags,
      };
      const saved = noteId
        ? await releaseNotesApi.update(noteId, payload)
        : await releaseNotesApi.create(payload);
      toast.success(noteId ? t("saved") : t("createdDraft"));
      router.replace(`/updates/${saved.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER2101") toast.error(t("bodyTooBig"));
      else toast.error(t("genericError"));
      setSaving(false);
    }
  }

  if (!userLoading && !can(PERMISSIONS.releaseNotesManage)) {
    router.replace("/updates");
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href={noteId ? `/updates/${noteId}` : "/updates"}
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tc("cancel")}
      </Link>

      <h1 className="text-xl font-bold">{noteId ? t("editTitle") : t("createTitle")}</h1>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("noteTitle")}</Label>
        <Input value={title} maxLength={300} placeholder={t("titlePlaceholder")} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("summary")}</Label>
        <Input value={summary} maxLength={500} placeholder={t("summaryPlaceholder")} onChange={(e) => setSummary(e.target.value)} />
        <span className="text-xs text-muted-foreground">{t("summaryHint")}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-muted-foreground">{t("areaLabel")}</Label>
          <Select
            value={area}
            items={{ frontend: t("area.frontend"), api: t("area.api"), both: t("area.both") }}
            onValueChange={(v) => setArea((v ?? "frontend") as ReleaseArea)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="w-auto min-w-44">
              <SelectItem value="frontend">{t("area.frontend")}</SelectItem>
              <SelectItem value="api">{t("area.api")}</SelectItem>
              <SelectItem value="both">{t("area.both")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-muted-foreground">{t("audienceLabel")}</Label>
          <Select
            value={audience}
            items={{ staff: t("audienceStaff"), all: t("audienceAll") }}
            onValueChange={(v) => setAudience((v ?? "staff") as ReleaseAudience)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">{t("audienceStaff")}</SelectItem>
              <SelectItem value="all">{t("audienceAll")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {area !== "api" && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">{t("frontVersion")}</Label>
            <Input value={frontVersion} maxLength={40} placeholder="0.42.0" className="tabular-nums" onChange={(e) => setFrontVersion(e.target.value)} />
          </div>
        )}
        {area !== "frontend" && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">{t("apiVersion")}</Label>
            <Input value={apiVersion} maxLength={40} placeholder="0.49.0" className="tabular-nums" onChange={(e) => setApiVersion(e.target.value)} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("tags")}</Label>
        <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-border px-2 py-1">
          {tags.map((x) => (
            <span key={x} className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
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
              if (e.key === "Backspace" && !tagInput && tags.length) setTags((p) => p.slice(0, -1));
            }}
            onBlur={() => tagInput.trim() && addTag(tagInput)}
            placeholder={tags.length ? "" : t("tagsPlaceholder")}
            className="min-w-16 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={pinned} onCheckedChange={setPinned} />
          {t("pinnedLabel")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={important} onCheckedChange={setImportant} />
          {t("importantLabel")}
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("body")}</Label>
        <div className="min-h-64 rounded-lg border border-border px-3 py-3 focus-within:border-primary/40">
          <BlockEditor ref={editorRef} initialData={initialContent} uploadImage={uploadReleaseNoteImage} />
        </div>
        <span className="text-xs text-muted-foreground">{t("editorHint")}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(noteId ? `/updates/${noteId}` : "/updates")}>
          {tc("cancel")}
        </Button>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? <Spinner className="size-4" /> : t("saveDraft")}
        </Button>
      </div>
    </div>
  );
}
