"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Paperclip, Pencil, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { EditorRenderer } from "./editor/editor-renderer";
import { fileProxyUrl } from "./editor/shared";
import type { Article } from "@/lib/api";
import { knowledgeApi, SessionExpiredError } from "@/lib/api-authed";
import { logActivity } from "@/lib/activity-log";
import { PERMISSIONS } from "@/lib/permissions";
import { Link, useRouter } from "@/i18n/navigation";

export function ArticleView({ articleId }: { articleId: string }) {
  const t = useTranslations("Knowledge");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.knowledgeManage);

  const [article, setArticle] = useState<Article | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    knowledgeApi
      .get(articleId)
      .then(setArticle)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  useEffect(() => load(), [load]);

  async function remove() {
    try {
      await knowledgeApi.remove(articleId);
      logActivity({
        type: "knowledge.delete",
        category: "База знаний",
        description: "Удаление статьи БЗ",
        targetType: "knowledge",
        targetId: articleId,
        meta: { title: article?.title },
      });
      toast.success(t("deleted"));
      router.replace("/knowledge");
    } catch {
      toast.error(t("genericError"));
    }
  }

  if (!article) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso)
    );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        href="/knowledge"
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-2xl font-bold">{article.title}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {article.category && (
              <Badge variant="secondary" className="bg-accent-light text-primary">
                {article.category}
              </Badge>
            )}
            {article.tags.map((x) => (
              <span key={x} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                #{x}
              </span>
            ))}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/knowledge/${article.id}/edit`)}
            >
              <Pencil className="size-4" />
              {tc("edit")}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tc("delete")}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {article.content?.blocks?.length ? (
        <EditorRenderer content={article.content} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("noBody")}</p>
      )}

      {article.attachments.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("attachments")}
          </span>
          <div className="flex flex-col gap-1">
            {article.attachments.map((f) => (
              <a
                key={f.id}
                href={fileProxyUrl(f.url)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.originalName}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <span className="text-xs text-muted-foreground">
        {article.author && t("articleAuthor", { name: article.author.name })}
        {" · "}
        {t("articleUpdated", { time: fmtDate(article.updatedAt) })}
      </span>

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
