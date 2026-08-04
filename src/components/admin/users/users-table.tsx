"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Search, UsersRound } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { UserDrawer } from "./user-drawer";
import type { Page, Role, UserProfile } from "@/lib/api";
import { adminApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { formatRelativeTime } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";

export function UsersTable() {
  const t = useTranslations("AdminUsers");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [status, setStatus] = useState<"" | "active" | "blocked">("");
  const [roleId, setRoleId] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<UserProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<UserProfile | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при смене фильтров
    setPage(1);
  }, [debouncedSearch, status, roleId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.users.list({
        page,
        search: debouncedSearch || undefined,
        status: status || undefined,
        roleId: roleId || undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/tc нестабильны, методы стабильны
  }, [page, debouncedSearch, status, roleId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await осознанный
    void load();
  }, [load]);

  useEffect(() => {
    if (can(PERMISSIONS.rolesRead)) {
      adminApi.roles.list().then(setRoles).catch(() => {});
    }
  }, [can]);

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
            className="w-64 pl-9"
          />
        </div>

        <Select
          value={status || "any"}
          items={{
            any: t("allStatuses"),
            active: t("statusActive"),
            blocked: t("statusBlocked"),
          }}
          onValueChange={(v) =>
            setStatus(v === "any" ? "" : (v as "active" | "blocked"))
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("allStatuses")}</SelectItem>
            <SelectItem value="active">{t("statusActive")}</SelectItem>
            <SelectItem value="blocked">{t("statusBlocked")}</SelectItem>
          </SelectContent>
        </Select>

        {roles.length > 0 && (
          <Select
            value={roleId || "any"}
            items={Object.fromEntries([
              ["any", t("allRoles")],
              ...roles.map((r) => [r.id, r.name]),
            ])}
            onValueChange={(v) => setRoleId(v === "any" ? "" : (v as string))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("allRoles")}</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {data && (
          <span className="ms-auto text-sm text-muted-foreground tabular-nums">
            {t("total", { count: data.total })}
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <UsersRound className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border duration-450 animate-in fade-in slide-in-from-bottom-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columnName")}</TableHead>
                <TableHead>{t("columnPhone")}</TableHead>
                <TableHead>{t("columnRole")}</TableHead>
                <TableHead>{t("columnStatus")}</TableHead>
                <TableHead className="text-right">
                  {t("columnRegistered")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((u) => (
                <TableRow
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.phone}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        u.status === "blocked"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-success-light text-success"
                      }
                    >
                      {t(u.status === "blocked" ? "statusBlocked" : "statusActive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {formatRelativeTime(u.createdAt, locale)}
                  </TableCell>
                </TableRow>
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

      <UserDrawer
        user={selected}
        roles={roles}
        onClose={() => setSelected(null)}
        onChanged={(updated) => {
          setSelected(updated);
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  items: prev.items.map((u) =>
                    u.id === updated.id ? updated : u
                  ),
                }
              : prev
          );
        }}
      />
    </div>
  );
}
