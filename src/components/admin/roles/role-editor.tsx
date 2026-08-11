"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, type PermissionDef, type Role } from "@/lib/api";
import { adminApi } from "@/lib/api-authed";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/utils";

const TITLE_LOCALES = ["ru", "uz", "en"] as const;

/** Редактор роли: поля + матрица прав с поиском и групповым выбором */
export function RoleEditor({
  role,
  permissions,
  canManage,
  onSaved,
  onDelete,
}: {
  /** null — создание новой роли */
  role: Role | null;
  permissions: PermissionDef[];
  canManage: boolean;
  onSaved: () => void;
  onDelete: (role: Role) => void;
}) {
  const t = useTranslations("AdminRoles");
  const locale = useLocale();
  const isNew = role === null;
  const isAdminRole = role?.permissions.includes("*") ?? false;
  const slugLocked = role?.isSystem ?? false;
  const readOnly = !canManage;

  const [slug, setSlug] = useState(role?.slug ?? "");
  const [titles, setTitles] = useState({
    ru: role?.title.ru ?? "",
    uz: role?.title.uz ?? "",
    en: role?.title.en ?? "",
  });
  const [description, setDescription] = useState(role?.description ?? "");
  const [checked, setChecked] = useState<Set<string>>(
    new Set(role?.permissions ?? [])
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (isNew) return true;
    if (!role) return false;
    const initial = new Set(role.permissions);
    return (
      slug !== role.slug ||
      titles.ru !== (role.title.ru ?? "") ||
      titles.uz !== (role.title.uz ?? "") ||
      titles.en !== (role.title.en ?? "") ||
      description !== (role.description ?? "") ||
      checked.size !== initial.size ||
      [...checked].some((key) => !initial.has(key))
    );
  }, [isNew, role, slug, titles, description, checked]);

  const groups = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    const q = query.trim().toLowerCase();
    for (const p of permissions) {
      if (q && !p.label.toLowerCase().includes(q) && !p.key.includes(q)) {
        continue;
      }
      map.set(p.group, [...(map.get(p.group) ?? []), p]);
    }
    return [...map.entries()];
  }, [permissions, query]);

  const checkedCount = isAdminRole
    ? permissions.length
    : permissions.filter((p) => checked.has(p.key)).length;

  function toggle(key: string, value: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleGroup(defs: PermissionDef[], value: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const p of defs) {
        if (value) next.add(p.key);
        else next.delete(p.key);
      }
      return next;
    });
  }

  async function save() {
    if (!slug.trim()) {
      setError(t("slugRequired"));
      return;
    }
    if (!titles.ru.trim()) {
      setError(t("titleRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const common = {
      title: {
        ru: titles.ru.trim(),
        uz: titles.uz.trim() || undefined,
        en: titles.en.trim() || undefined,
      },
      description: description.trim() || undefined,
    };
    try {
      if (isNew) {
        await adminApi.roles.create({
          slug: slug.trim(),
          ...common,
          permissions: [...checked],
        });
      } else if (role) {
        await adminApi.roles.update(role.id, {
          ...(slugLocked ? {} : { slug: slug.trim() }),
          ...common,
          ...(isAdminRole ? {} : { permissions: [...checked] }),
        });
      }
      toast.success(t("saved"));
      if (!isNew) toast(t("instantApply"));
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER301") setError(t("errors.ER301"));
      else if (e instanceof ApiError && e.code === "ER302")
        setError(t("errors.ER302"));
      else if (e instanceof ApiError && e.code === "ER101")
        setError(t("slugFormat"));
      else setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 rounded-lg border border-border p-5 duration-300 animate-in fade-in">
      {/* Шапка */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">
            {isNew
              ? t("newRole")
              : pickLocalized(role!.title, locale) || role!.slug}
          </h3>
          {!isNew && (
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
              {role!.slug}
            </code>
          )}
          {role?.isSystem && (
            <Badge variant="secondary">{t("systemBadge")}</Badge>
          )}
          {isAdminRole && (
            <Badge variant="secondary" className="bg-accent-light text-primary">
              {t("fullAccess")}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {isAdminRole ? t("adminReadOnly") : t("formHint")}
        </p>
      </div>

      {/* Поля */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="role-slug"
              className="text-sm font-medium text-muted-foreground"
            >
              {t("slug")}
            </Label>
            <Input
              id="role-slug"
              value={slug}
              disabled={slugLocked || readOnly}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setError(null);
              }}
              placeholder="support"
            />
            <span className="text-xs text-muted-foreground">
              {slugLocked ? t("systemNameLocked") : t("slugHint")}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              {t("titleSection")}
            </span>
            <div className="grid gap-2 sm:grid-cols-3">
              {TITLE_LOCALES.map((code) => (
                <div key={code} className="flex flex-col gap-1">
                  <Label
                    htmlFor={`role-title-${code}`}
                    className="text-xs uppercase text-muted-foreground"
                  >
                    {code}
                  </Label>
                  <Input
                    id={`role-title-${code}`}
                    value={titles[code]}
                    maxLength={100}
                    disabled={readOnly}
                    placeholder={code !== "ru" ? titles.ru : undefined}
                    onChange={(e) => {
                      setTitles((prev) => ({ ...prev, [code]: e.target.value }));
                      setError(null);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="role-desc"
            className="text-sm font-medium text-muted-foreground"
          >
            {t("descriptionLabel")}
          </Label>
          <Textarea
            id="role-desc"
            value={description}
            disabled={readOnly}
            onChange={(e) => setDescription(e.target.value)}
            className="flex-1 resize-none"
          />
        </div>
      </div>

      {/* Права */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{t("permissions")}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("checkedOf", {
                checked: checkedCount,
                total: permissions.length,
              })}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPermissions")}
              className="h-9 w-64 pl-9"
            />
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("nothingFound")}
          </p>
        ) : (
          groups.map(([group, defs]) => {
            const allChecked =
              isAdminRole || defs.every((p) => checked.has(p.key));
            return (
              <div
                key={group}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </span>
                  {!isAdminRole && !readOnly && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(defs, !allChecked)}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {allChecked ? t("clearAll") : t("selectAll")}
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {defs.map((p) => {
                    const isChecked = isAdminRole || checked.has(p.key);
                    return (
                      <label
                        key={p.key}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5 transition-colors",
                          isChecked && "border-primary/30 bg-accent-light/40",
                          (isAdminRole || readOnly) && "cursor-default"
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={isAdminRole || readOnly}
                          onCheckedChange={(value) => toggle(p.key, !!value)}
                          className="mt-0.5"
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm leading-tight">{p.label}</span>
                          <code className="truncate text-xs text-muted-foreground">
                            {p.key}
                          </code>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {canManage && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {!isNew && !role!.isSystem ? (
            <Button
              variant="ghost"
              onClick={() => onDelete(role!)}
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              {t("deleteAction")}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={busy || !dirty}>
            {busy ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
