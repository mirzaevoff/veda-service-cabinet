"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/components/common/date-picker";
import { UserPicker } from "@/components/common/user-picker";
import { useRouter } from "@/i18n/navigation";
import type { ActivityLog, ActivityLogSource, ActivityLogTypeDef, Page } from "@/lib/api";
import { activityLogsApi, SessionExpiredError } from "@/lib/api-authed";
import { useDelayed } from "@/hooks/use-delayed";
import { cn } from "@/lib/utils";

const ALL = "__all__";

/**
 * Семантические типы, которые эмитит кабинет, но которых пока нет в серверном
 * реестре `/activity-logs/types` — домешиваем в фильтры (категория/тип),
 * чтобы по ним можно было отбирать. Если появятся на сервере — дедупим по type.
 */
const CABINET_LOG_TYPES: ActivityLogTypeDef[] = [
  { type: "auth.login", category: "Авторизация", description: "Вход в систему" },
  { type: "auth.logout", category: "Авторизация", description: "Выход из системы" },
  { type: "knowledge.create", category: "База знаний", description: "Создание статьи БЗ" },
  { type: "knowledge.update", category: "База знаний", description: "Изменение статьи БЗ" },
  { type: "knowledge.delete", category: "База знаний", description: "Удаление статьи БЗ" },
  { type: "user.role.change", category: "Пользователи", description: "Смена роли пользователя" },
  { type: "user.profile.update", category: "Пользователи", description: "Изменение анкеты пользователя" },
  { type: "role.create", category: "Роли и доступы", description: "Создание роли" },
  { type: "role.update", category: "Роли и доступы", description: "Изменение роли" },
  { type: "role.delete", category: "Роли и доступы", description: "Удаление роли" },
  { type: "settings.update", category: "Настройки", description: "Изменение настройки" },
  { type: "venue.attach", category: "Заведения", description: "Привязка заведения к юрлицу" },
  { type: "venue.detach", category: "Заведения", description: "Отвязка заведения от юрлица" },
];

function statusTone(code: number | null): string {
  if (code === null) return "text-muted-foreground";
  if (code >= 500) return "text-destructive";
  if (code >= 400) return "text-warning";
  return "text-success";
}

export function ActivityLogsTable() {
  const t = useTranslations("AdminLogs");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [types, setTypes] = useState<ActivityLogTypeDef[]>([]);
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [source, setSource] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Page<ActivityLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    void activityLogsApi.types().then(setTypes).catch(() => {});
  }, []);

  const allTypes = useMemo(() => {
    const seen = new Set(types.map((x) => x.type));
    return [...types, ...CABINET_LOG_TYPES.filter((x) => !seen.has(x.type))];
  }, [types]);
  const categories = useMemo(
    () => [...new Set(allTypes.map((x) => x.category))].sort((a, b) => a.localeCompare(b)),
    [allTypes]
  );
  const typeOptions = useMemo(
    () => (category === ALL ? allTypes : allTypes.filter((x) => x.category === category)),
    [allTypes, category]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при смене фильтров
    setPage(1);
  }, [user, source, category, type, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await activityLogsApi.list({
        page,
        limit: 20,
        userId: user?.id,
        source: source === ALL ? undefined : (source as ActivityLogSource),
        category: category === ALL ? undefined : category,
        type: type === ALL ? undefined : type,
        from: from ? `${from}T00:00:00.000Z` : undefined,
        to: to ? `${to}T23:59:59.999Z` : undefined,
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
  }, [page, user, source, category, type, from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const hasFilters =
    !!user || source !== ALL || category !== ALL || type !== ALL || !!from || !!to;

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [locale]
  );

  function resetFilters() {
    setUser(null);
    setSource(ALL);
    setCategory(ALL);
    setType(ALL);
    setFrom("");
    setTo("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        <UserPicker
          value={user}
          onChange={setUser}
          placeholder={t("allUsers")}
          className="w-56"
        />
        <Select
          value={source}
          items={{
            [ALL]: t("allSources"),
            frontend: t("sourceFrontend"),
            backend: t("sourceBackend"),
          }}
          onValueChange={(v) => setSource(v ?? ALL)}
        >
          <SelectTrigger className="h-9 w-auto min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allSources")}</SelectItem>
            <SelectItem value="frontend">{t("sourceFrontend")}</SelectItem>
            <SelectItem value="backend">{t("sourceBackend")}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={category}
          items={{
            [ALL]: t("allCategories"),
            ...Object.fromEntries(categories.map((c) => [c, c])),
          }}
          onValueChange={(v) => {
            setCategory(v ?? ALL);
            setType(ALL);
          }}
        >
          <SelectTrigger className="h-9 w-auto min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-auto max-w-[min(20rem,90vw)]">
            <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={type}
          items={{
            [ALL]: t("allTypes"),
            ...Object.fromEntries(typeOptions.map((x) => [x.type, x.description])),
          }}
          onValueChange={(v) => setType(v ?? ALL)}
        >
          <SelectTrigger className="h-9 w-auto min-w-44 max-w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-auto max-w-[min(24rem,90vw)]">
            <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
            {typeOptions.map((x) => (
              <SelectItem key={x.type} value={x.type}>
                {x.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePicker value={from} onChange={setFrom} placeholder={t("from")} />
        <DatePicker value={to} onChange={setTo} placeholder={t("to")} />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground"
          >
            {t("reset")}
          </Button>
        )}
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <ScrollText className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">
            {hasFilters ? t("emptyFiltered") : t("empty")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border duration-450 animate-in fade-in slide-in-from-bottom-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">{t("colWhen")}</TableHead>
                <TableHead className="w-44">{t("colWho")}</TableHead>
                <TableHead>{t("colAction")}</TableHead>
                <TableHead className="w-24">{t("colSource")}</TableHead>
                <TableHead className="w-32">{t("colIp")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="align-top text-xs text-muted-foreground tabular-nums">
                    {log.createdAt ? dateFmt.format(new Date(log.createdAt)) : "—"}
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {log.user ? (
                      log.user.name
                    ) : (
                      <span className="text-muted-foreground">{t("system")}</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm">
                        {log.description ||
                          (log.method
                            ? `${log.method} ${log.path}`
                            : log.type)}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {log.category && <span>{log.category}</span>}
                        <span className="font-mono">{log.type}</span>
                        {log.statusCode !== null && (
                          <span
                            className={cn(
                              "font-mono tabular-nums",
                              statusTone(log.statusCode)
                            )}
                          >
                            {log.statusCode}
                          </span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "font-normal",
                        log.source === "frontend"
                          ? "bg-accent-light text-primary"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {t(log.source === "frontend" ? "sourceFrontend" : "sourceBackend")}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top text-xs text-muted-foreground tabular-nums">
                    {log.ip || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.items.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={tc("prevPage")}
            disabled={data.page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {data.page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={tc("nextPage")}
            disabled={data.page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
