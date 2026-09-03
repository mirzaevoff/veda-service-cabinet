"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { BlockEditor, type BlockEditorHandle } from "./editor/block-editor";
import { ApiError, type Article, type EditorJsData } from "@/lib/api";
import { knowledgeApi, SessionExpiredError } from "@/lib/api-authed";
import { logActivity } from "@/lib/activity-log";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";

/** Редактор статьи базы знаний. articleId=null — создание */
export function ArticleEditor({ articleId }: { articleId: string | null }) {
  const t = useTranslations("Knowledge");
  const tc = useTranslations("Common");
  const router = useRouter();
  const { can, loading: userLoading } = useCurrentUser();

  const [loaded, setLoaded] = useState(articleId === null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [initialContent, setInitialContent] = useState<EditorJsData | undefined>();
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<BlockEditorHandle>(null);

  useEffect(() => {
    if (!articleId) return;
    knowledgeApi
      .get(articleId)
      .then((a) => {
        setTitle(a.title);
        setCategory(a.category);
        setTags(a.tags);
        setInitialContent(a.content);
        setLoaded(true);
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

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
        content,
        category: category.trim(),
        tags,
      };
      const saved: Article = articleId
        ? await knowledgeApi.update(articleId, payload)
        : await knowledgeApi.create(payload);
      logActivity({
        type: articleId ? "knowledge.update" : "knowledge.create",
        category: "База знаний",
        description: articleId ? "Изменение статьи БЗ" : "Создание статьи БЗ",
        targetType: "knowledge",
        targetId: saved.id,
        meta: { title: saved.title },
      });
      toast.success(articleId ? t("saved") : t("createdArticle"));
      router.replace(`/knowledge/${saved.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER2001") toast.error(t("bodyTooBig"));
      else toast.error(t("genericError"));
      setSaving(false);
    }
  }

  if (!userLoading && !can(PERMISSIONS.knowledgeManage)) {
    router.replace("/knowledge");
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
        href={articleId ? `/knowledge/${articleId}` : "/knowledge"}
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tc("cancel")}
      </Link>

      <h1 className="text-xl font-bold">{articleId ? t("editTitle") : t("createTitle")}</h1>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("articleTitle")}</Label>
        <Input value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-muted-foreground">{t("category")}</Label>
          <Input
            value={category}
            maxLength={100}
            placeholder={t("categoryPlaceholder")}
            onChange={(e) => setCategory(e.target.value)}
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
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === "," || e.key === " ") && tagInput.trim()) {
                  e.preventDefault();
                  addTag(tagInput);
                }
                if (e.key === "Backspace" && !tagInput && tags.length)
                  setTags((p) => p.slice(0, -1));
              }}
              onBlur={() => tagInput.trim() && addTag(tagInput)}
              placeholder={tags.length ? "" : t("tagsPlaceholder")}
              className="min-w-16 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-muted-foreground">{t("body")}</Label>
        <div className="min-h-64 rounded-lg border border-border px-3 py-3 focus-within:border-primary/40">
          <BlockEditor ref={editorRef} initialData={initialContent} />
        </div>
        <span className="text-xs text-muted-foreground">{t("editorHint")}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => router.push(articleId ? `/knowledge/${articleId}` : "/knowledge")}
        >
          {tc("cancel")}
        </Button>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? <Spinner className="size-4" /> : tc("save")}
        </Button>
      </div>
    </div>
  );
}
