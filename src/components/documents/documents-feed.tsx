"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, FileText, Plus, Search } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { DocumentStatus, DocumentsPage, DocumentType } from "@/lib/api";
import { documentsApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { formatRelativeTime } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";
import { documentStatusStyle } from "./documents-format";
import { DocumentTypeBadge } from "./document-type-badge";
import { DocumentTypesManager } from "./document-types-manager";

const ALL = "__all__";
const STATUSES: DocumentStatus[] = ["draft", "pending", "active", "archived"];

export function DocumentsFeed() {
  const t = useTranslations("Documents");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.documentsManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [typeId, setTypeId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [tag, setTag] = useState(ALL);
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [data, setData] = useState<DocumentsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayed(loading && !data);

  const loadFilters = useCallback(() => {
    void documentsApi.types().then(setTypes).catch(() => {});
    void documentsApi.tags().then(setTags).catch(() => {});
  }, []);

  useEffect(() => loadFilters(), [loadFilters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, typeId, status, tag, mine]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await documentsApi.list({
        page,
        search: debouncedSearch || undefined,
        typeId: typeId === ALL ? undefined : typeId,
        status: status === ALL ? undefined : (status as DocumentStatus),
        tag: tag === ALL ? undefined : tag,
        mine: mine || undefined,
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
  }, [page, debouncedSearch, typeId, status, tag, mine]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const hasFilters = !!debouncedSearch || typeId !== ALL || status !== ALL || tag !== ALL || mine;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="w-60 pl-9"
          />
        </div>

        {types.length > 0 && (
          <Select
            value={typeId}
            items={{ [ALL]: t("allTypes"), ...Object.fromEntries(types.map((x) => [x.id, x.name])) }}
            onValueChange={(v) => setTypeId(v ?? ALL)}
          >
            <SelectTrigger className="h-9 w-auto min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-40">
              <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
              {types.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={status}
          items={{
            [ALL]: t("allStatuses"),
            ...Object.fromEntries(STATUSES.map((s) => [s, t(`status.${s}`)])),
          }}
          onValueChange={(v) => setStatus(v ?? ALL)}
        >
          <SelectTrigger className="h-9 w-auto min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-40">
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.length > 0 && (
          <Select
            value={tag}
            items={{ [ALL]: t("allTags"), ...Object.fromEntries(tags.map((x) => [x, x])) }}
            onValueChange={(v) => setTag(v ?? ALL)}
          >
            <SelectTrigger className="h-9 w-auto min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-40">
              <SelectItem value={ALL}>{t("allTags")}</SelectItem>
              {tags.map((x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={mine} onCheckedChange={setMine} />
          {t("mineOnly")}
        </label>

        {canManage && (
          <div className="ms-auto flex items-center gap-2">
            <DocumentTypesManager onChange={loadFilters} />
            <Button onClick={() => router.push("/documents/new")} className="gap-2">
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
              <Skeleton key={i} className="h-20 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <FileText className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">
            {hasFilters ? tc("nothingFound") : t("empty")}
          </p>
          {canManage && !hasFilters && (
            <>
              <p className="-mt-2 text-xs text-muted-foreground">{t("emptyHint")}</p>
              <Button onClick={() => router.push("/documents/new")} variant="outline" className="gap-2">
                <Plus className="size-4" />
                {t("create")}
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => router.push(`/documents/${d.id}`)}
              className="flex flex-col gap-1.5 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/40 duration-450 animate-in fade-in"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.title}</span>
                {d.type && <DocumentTypeBadge type={d.type} />}
                <Badge variant="secondary" className={documentStatusStyle(d.status)}>
                  {t(`status.${d.status}`)}
                </Badge>
                {d.status === "pending" && (
                  <span className="text-xs text-warning">
                    {t("confirmProgress", {
                      count: d.confirmationsCount,
                      required: d.requiredConfirmations,
                    })}
                  </span>
                )}
              </div>
              {d.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.tags.map((x) => (
                    <span
                      key={x}
                      className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      #{x}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {d.author && <span>{t("author", { name: d.author.name })}</span>}
                <span>·</span>
                <span>{t("updated", { time: formatRelativeTime(d.updatedAt, locale) })}</span>
                {canManage && d.status === "active" && (
                  <>
                    <span>·</span>
                    <span>{t("acknowledgedShort", { count: d.acknowledgmentsCount })}</span>
                  </>
                )}
              </div>
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
