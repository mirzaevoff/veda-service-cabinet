"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Newspaper,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { Post, PostLocale, PostsPage, PostStatus } from "@/lib/api";
import { postsApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { fileProxyUrl } from "@/components/knowledge/editor/shared";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { POST_LOCALES, liveUrl } from "./post-utils";

const STATUSES: PostStatus[] = ["draft", "published", "archived"];

export function PostsList() {
  const t = useTranslations("Posts");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.postsManage);

  const [status, setStatus] = useState<PostStatus | "">("");
  const [postLocale, setPostLocale] = useState<PostLocale | "">("");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 350);
  const [tags, setTags] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PostsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    postsApi.tags().then(setTags).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await postsApi.list({
        page,
        status: status || undefined,
        locale: postLocale || undefined,
        tag: tag || undefined,
        search: debounced || undefined,
      });
      if (result.items.length === 0 && result.page > 1) {
        setPage(1);
        return;
      }
      setData(result);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- методы стабильны
  }, [page, status, postLocale, tag, debounced]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await осознанный
    void load();
  }, [load]);

  // Сброс на первую страницу при смене фильтров
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация пагинации с фильтрами
    setPage(1);
  }, [status, postLocale, tag, debounced]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const fmtDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(iso))
      : "—";

  const selectCls =
    "h-9 rounded-md border border-border bg-transparent px-2.5 text-sm outline-none focus-visible:border-primary/40";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {/* Тулбар */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PostStatus | "")}
          className={selectCls}
          aria-label={t("status")}
        >
          <option value="">{t("allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </select>

        <select
          value={postLocale}
          onChange={(e) => setPostLocale(e.target.value as PostLocale | "")}
          className={selectCls}
          aria-label={t("language")}
        >
          <option value="">{t("allLanguages")}</option>
          {POST_LOCALES.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>

        {tags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className={selectCls}
            aria-label={t("tag")}
          >
            <option value="">{t("allTags")}</option>
            {tags.map((x) => (
              <option key={x} value={x}>
                #{x}
              </option>
            ))}
          </select>
        )}

        {canManage && (
          <Button onClick={() => router.push("/posts/new")} className="ms-auto gap-2">
            <Plus className="size-4" />
            {t("create")}
          </Button>
        )}
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <Newspaper className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">{t("empty")}</p>
          {canManage && (
            <Button onClick={() => router.push("/posts/new")} variant="outline" className="gap-2">
              <Plus className="size-4" />
              {t("create")}
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colTitle")}</TableHead>
                <TableHead>{t("colLanguage")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("colTags")}</TableHead>
                <TableHead>{t("colPublished")}</TableHead>
                <TableHead>{t("colAuthor")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <PostRow key={p.id} post={p} fmtDate={fmtDate} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            aria-label={tc("prevPage")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            aria-label={tc("nextPage")}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function PostRow({
  post,
  fmtDate,
}: {
  post: Post;
  fmtDate: (iso: string | null) => string;
}) {
  const t = useTranslations("Posts");
  const router = useRouter();

  const statusCls: Record<PostStatus, string> = {
    draft: "bg-secondary text-muted-foreground",
    published: "bg-success-light text-success",
    archived: "bg-secondary text-muted-foreground line-through",
  };

  return (
    <TableRow
      onClick={() => router.push(`/posts/${post.id}`)}
      className="cursor-pointer"
    >
      <TableCell>
        <div className="flex items-center gap-3">
          {post.cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- внешняя обложка
            <img
              src={fileProxyUrl(post.cover.url)}
              alt=""
              className="size-10 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Newspaper className="size-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{post.title}</span>
            <span className="truncate text-xs text-muted-foreground">/{post.slug}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground uppercase">{post.locale}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className={cn(statusCls[post.status])}>
            {t(`statuses.${post.status}`)}
          </Badge>
          {post.status === "published" && (
            <a
              href={liveUrl(post.locale, post.slug)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground transition-colors hover:text-primary"
              aria-label={t("openLive")}
              title={t("openLive")}
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-48">
        <span className="truncate text-xs text-muted-foreground">
          {post.tags.length ? post.tags.map((x) => `#${x}`).join(" ") : "—"}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {fmtDate(post.publishedAt)}
      </TableCell>
      <TableCell className="text-muted-foreground">{post.author?.name || "—"}</TableCell>
    </TableRow>
  );
}
