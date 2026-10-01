"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  ImagePlus,
  Languages,
  Send,
  Trash2,
  X,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { BlockEditor, type BlockEditorHandle } from "@/components/knowledge/editor/block-editor";
import { fileProxyUrl } from "@/components/knowledge/editor/shared";
import {
  ApiError,
  type EditorJsData,
  type Post,
  type PostLocale,
} from "@/lib/api";
import { postsApi, SessionExpiredError } from "@/lib/api-authed";
import { uploadPostImage } from "@/lib/upload";
import { logActivity } from "@/lib/activity-log";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { PublishDialog } from "./publish-dialog";
import { PostPublications } from "./post-publications";
import { POST_LOCALES, SITE_URL, liveUrl, slugify, suggestSlug } from "./post-utils";

/** Экран 2: редактор поста. postId=null — создание */
export function PostEditor({ postId }: { postId: string | null }) {
  const t = useTranslations("Posts");
  const tc = useTranslations("Common");
  const router = useRouter();
  const { can, loading: userLoading } = useCurrentUser();

  const [loaded, setLoaded] = useState(postId === null);
  const [post, setPost] = useState<Post | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [locale, setLocale] = useState<PostLocale>("ru");
  const [excerpt, setExcerpt] = useState("");
  const [coverId, setCoverId] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [initialContent, setInitialContent] = useState<EditorJsData | undefined>();

  const [showSeo, setShowSeo] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);

  const editorRef = useRef<BlockEditorHandle>(null);

  useEffect(() => {
    if (!postId) return;
    postsApi
      .get(postId)
      .then((p) => {
        applyPost(p);
        setLoaded(true);
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  function applyPost(p: Post) {
    setPost(p);
    setTitle(p.title);
    setSlug(p.slug);
    setLocale(p.locale);
    setExcerpt(p.excerpt);
    setCoverId(p.cover?.id ?? null);
    setCoverUrl(p.cover?.url ?? "");
    setTags(p.tags);
    setSeoTitle(p.seo.title);
    setSeoDesc(p.seo.description);
    setInitialContent(p.content);
  }

  const isPublished = post?.status === "published";
  const slugChanged = !!post && slug.trim() !== post.slug;
  const previewSlug = slug.trim() || slugify(title) || "…";

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 30) setTags((p) => [...p, tag]);
    setTagInput("");
  }

  async function pickCover() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingCover(true);
      try {
        const res = await uploadPostImage(file);
        setCoverId(res.file.id);
        setCoverUrl(res.file.url);
      } catch (e) {
        const code = (e as { code?: string })?.code;
        toast.error(code === "ER502" ? t("coverTooBig") : t("coverFailed"));
      } finally {
        setUploadingCover(false);
      }
    };
    input.click();
  }

  async function save(): Promise<Post | null> {
    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return null;
    }
    setSaving(true);
    setSlugError(null);
    try {
      const content = (await editorRef.current?.save()) ?? { blocks: [] };
      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        locale,
        excerpt: excerpt.trim(),
        content,
        coverId,
        tags,
        seo: { title: seoTitle.trim(), description: seoDesc.trim() },
      };
      const saved = postId
        ? await postsApi.update(postId, payload)
        : await postsApi.create(payload);
      logActivity({
        type: postId ? "post.update" : "post.create",
        category: "Посты сайта",
        targetType: "post",
        targetId: saved.id,
        meta: { title: saved.title },
      });
      toast.success(postId ? t("saved") : t("created"));
      if (!postId) {
        router.replace(`/posts/${saved.id}`);
      } else {
        applyPost(saved);
      }
      return saved;
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER2701") setSlugError(t("slugTaken"));
      else if (e instanceof ApiError && e.code === "ER2702") toast.error(t("bodyTooBig"));
      else toast.error(t("genericError"));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function openPublish() {
    // Сохраняем перед публикацией, чтобы в эфир ушла актуальная версия
    const saved = await save();
    if (saved) setPublishOpen(true);
  }

  async function unpublish() {
    if (!postId) return;
    try {
      const updated = await postsApi.unpublish(postId);
      applyPost(updated);
      setConfirmUnpublish(false);
      toast.success(t("unpublished"));
    } catch {
      toast.error(t("genericError"));
    }
  }

  async function remove() {
    if (!postId) return;
    try {
      await postsApi.remove(postId);
      toast.success(t("deleted"));
      router.replace("/posts");
    } catch {
      toast.error(t("genericError"));
      setConfirmDelete(false);
    }
  }

  async function createTranslation(target: PostLocale) {
    setShowTranslate(false);
    try {
      const content = (await editorRef.current?.save()) ?? { blocks: [] };
      const created = await postsApi.create({
        title: title.trim() || t("untitled"),
        locale: target,
        excerpt: excerpt.trim(),
        content,
        tags,
      });
      toast.success(t("translationCreated"));
      router.push(`/posts/${created.id}`);
    } catch {
      toast.error(t("genericError"));
    }
  }

  if (!userLoading && !can(PERMISSIONS.postsManage)) {
    router.replace("/");
    return null;
  }

  if (!loaded) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  const selectCls =
    "h-9 w-full rounded-md border border-border bg-transparent px-2.5 text-sm outline-none focus-visible:border-primary/40";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/posts"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("title")}
        </Link>
        <div className="flex items-center gap-2">
          {post && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranslate((v) => !v)}
                className="gap-1.5"
              >
                <Languages className="size-4" />
                {t("translate")}
              </Button>
              {showTranslate && (
                <div className="absolute right-0 z-10 mt-1 flex flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md">
                  {POST_LOCALES.filter((l) => l !== locale).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => void createTranslation(l)}
                      className="rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
                    >
                      {t("translateTo", { lang: l.toUpperCase() })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? <Spinner className="size-4" /> : tc("save")}
          </Button>
          {post && (
            <Button size="sm" className="gap-1.5" onClick={() => void openPublish()}>
              <Send className="size-4" />
              {isPublished ? t("republish") : t("publishAction")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Левая колонка: заголовок + тело */}
        <div className="flex flex-col gap-3">
          <input
            value={title}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/50"
          />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate">
              {SITE_URL.replace(/^https?:\/\//, "")}/{locale}/posts/{previewSlug}
            </span>
          </p>
          <div className="min-h-80 rounded-lg border border-border px-3 py-3 focus-within:border-primary/40">
            <BlockEditor
              ref={editorRef}
              initialData={initialContent}
              uploadImage={uploadPostImage}
              placeholder={t("bodyPlaceholder")}
            />
          </div>
          <span className="text-xs text-muted-foreground">{t("bodyHint")}</span>

          {post && post.publications.length > 0 && (
            <PostPublications publications={post.publications} />
          )}
        </div>

        {/* Правая панель: настройки публикации */}
        <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("settings")}
          </h3>

          {/* Язык */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-muted-foreground">{t("language")}</Label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as PostLocale)}
              className={selectCls}
            >
              {POST_LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Адрес (slug) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-muted-foreground">{t("slug")}</Label>
            <Input
              value={slug}
              maxLength={200}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugError(null);
              }}
              placeholder={slugify(title) || t("slugPlaceholder")}
            />
            <a
              href={liveUrl(locale, previewSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              {liveUrl(locale, previewSlug).replace(/^https?:\/\//, "")}
            </a>
            {slugError && (
              <div className="flex flex-col gap-1 text-xs text-destructive">
                <span>{slugError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSlug(suggestSlug(slug.trim() || slugify(title)));
                    setSlugError(null);
                  }}
                  className="self-start font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t("useSuggestion", { slug: suggestSlug(slug.trim() || slugify(title)) })}
                </button>
              </div>
            )}
            {isPublished && slugChanged && !slugError && (
              <span className="text-xs text-warning">{t("slugChangeWarning")}</span>
            )}
          </div>

          {/* Обложка */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-muted-foreground">{t("cover")}</Label>
            {coverUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- внешняя обложка */}
                <img
                  src={fileProxyUrl(coverUrl)}
                  alt=""
                  className="h-32 w-full rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCoverId(null);
                    setCoverUrl("");
                  }}
                  className="absolute right-2 top-2 rounded-md bg-background/90 p-1 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                  aria-label={t("coverRemove")}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void pickCover()}
                disabled={uploadingCover}
                className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {uploadingCover ? (
                  <Spinner className="size-5" />
                ) : (
                  <>
                    <ImagePlus className="size-5" />
                    {t("coverUpload")}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Теги */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-muted-foreground">{t("tags")}</Label>
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

          {/* Анонс */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-muted-foreground">{t("excerpt")}</Label>
            <textarea
              value={excerpt}
              maxLength={500}
              rows={3}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder={t("excerptPlaceholder")}
              className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-primary/40"
            />
            <span className="text-xs text-muted-foreground">{t("excerptHint")}</span>
          </div>

          {/* SEO (свёрнуто) */}
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowSeo((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown className={cn("size-4 transition-transform", showSeo && "rotate-180")} />
              {t("seo")}
            </button>
            {showSeo && (
              <div className="flex flex-col gap-2">
                <Input
                  value={seoTitle}
                  maxLength={200}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder={t("seoTitlePlaceholder")}
                />
                <textarea
                  value={seoDesc}
                  maxLength={400}
                  rows={2}
                  onChange={(e) => setSeoDesc(e.target.value)}
                  placeholder={t("seoDescPlaceholder")}
                  className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-primary/40"
                />
                <span className="text-xs text-muted-foreground">{t("seoHint")}</span>
              </div>
            )}
          </div>

          {/* Опасная зона */}
          {post && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {isPublished && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setConfirmUnpublish(true)}
                >
                  <ExternalLink className="size-4" />
                  {t("unpublish")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                {t("delete")}
              </Button>
            </div>
          )}
        </aside>
      </div>

      {post && (
        <PublishDialog
          open={publishOpen}
          post={post}
          onClose={() => setPublishOpen(false)}
          onPublished={applyPost}
        />
      )}

      <AlertDialog open={confirmUnpublish} onOpenChange={setConfirmUnpublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("unpublishConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("unpublishConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void unpublish()}>
              {t("unpublish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
