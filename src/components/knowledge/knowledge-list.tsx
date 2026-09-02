"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { ArticlesPage } from "@/lib/api";
import { knowledgeApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { formatRelativeTime } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";

const ALL = "__all__";

export function KnowledgeList() {
  const t = useTranslations("Knowledge");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.knowledgeManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [tag, setTag] = useState(ALL);
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [data, setData] = useState<ArticlesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    void knowledgeApi.tags().then(setTags).catch(() => {});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, tag]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await knowledgeApi.list({
        page,
        search: debouncedSearch || undefined,
        tag: tag === ALL ? undefined : tag,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, tag]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-72 pl-9"
          />
        </div>
        {tags.length > 0 && (
          <Select
            value={tag}
            items={{ [ALL]: t("allTags"), ...Object.fromEntries(tags.map((x) => [x, x])) }}
            onValueChange={(v) => setTag(v ?? ALL)}
          >
            <SelectTrigger className="h-9 w-auto min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allTags")}</SelectItem>
              {tags.map((x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canManage && (
          <div className="ms-auto">
            <Button onClick={() => router.push("/knowledge/new")} className="gap-2">
              <Plus className="size-4" />
              {t("create")}
            </Button>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <BookOpen className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch || tag !== ALL ? t("emptySearch") : t("empty")}
          </p>
          {canManage && !debouncedSearch && tag === ALL && (
            <Button onClick={() => router.push("/knowledge/new")} variant="outline" className="gap-2">
              <Plus className="size-4" />
              {t("create")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => router.push(`/knowledge/${a.id}`)}
              className="flex flex-col gap-1.5 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/40 duration-450 animate-in fade-in"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.title}</span>
                {a.category && (
                  <Badge variant="secondary" className="bg-accent-light text-primary">
                    {a.category}
                  </Badge>
                )}
              </div>
              {a.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {a.tags.map((x) => (
                    <span key={x} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                      #{x}
                    </span>
                  ))}
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                {t("updated", { time: formatRelativeTime(a.updatedAt, locale) })}
                {a.updatedBy && ` · ${a.updatedBy.name}`}
              </span>
            </button>
          ))}
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
