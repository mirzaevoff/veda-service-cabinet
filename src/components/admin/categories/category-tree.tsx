"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  FolderTree,
  MoreHorizontal,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shell/page-header";
import { SeverityBadge } from "@/components/tickets/severity-badge";
import { CategoryFormDialog } from "./category-form-dialog";
import { CategoryDeleteDialog } from "./category-delete-dialog";
import type { TicketCategory, TicketSeverity } from "@/lib/api";
import {
  adminApi,
  severitiesApi,
  ticketsApi,
  SessionExpiredError,
} from "@/lib/api-authed";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { pickLocalized } from "@/lib/format";
import { useDelayed } from "@/hooks/use-delayed";

const byOrder = (a: TicketCategory, b: TicketCategory) =>
  a.order - b.order || a.name.ru.localeCompare(b.name.ru);

export interface CategoryEditState {
  mode: "create-root" | "create-child" | "rename";
  category?: TicketCategory;
  parent?: TicketCategory;
}

export function CategoryTree({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("AdminCategories");
  const locale = useLocale();
  const tc = useTranslations("Common");
  const router = useRouter();

  const [tree, setTree] = useState<TicketCategory[] | null>(null);
  const [editState, setEditState] = useState<CategoryEditState | null>(null);
  const [deleting, setDeleting] = useState<TicketCategory | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [severities, setSeverities] = useState<TicketSeverity[]>([]);
  const showSkeleton = useDelayed(!tree);

  useEffect(() => {
    severitiesApi.list().then(setSeverities).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setTree((await ticketsApi.categories()).slice().sort(byOrder));
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/tc нестабильны, методы стабильны
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState после await
    void load();
  }, [load]);

  async function toggleActive(category: TicketCategory, isActive: boolean) {
    // Optimistic с откатом
    setTree((prev) =>
      prev
        ? prev.map((c) =>
            c.id === category.id
              ? { ...c, isActive }
              : {
                  ...c,
                  children: c.children?.map((ch) =>
                    ch.id === category.id ? { ...ch, isActive } : ch
                  ),
                }
          )
        : prev
    );
    try {
      await adminApi.categories.update(category.id, { isActive });
    } catch {
      toast.error(t("errors.generic"));
      void load();
    }
  }

  async function move(
    siblings: TicketCategory[],
    index: number,
    direction: -1 | 1
  ) {
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;

    // Переставляем элемент и нормализуем order = позиция в списке.
    // Своп двух order не работал, когда у категорий одинаковый order (напр. все 0
    // у подкатегорий — API создаёт их с order:0) → своп нулей был no-op.
    const reordered = [...siblings];
    const [item] = reordered.splice(index, 1);
    reordered.splice(target, 0, item);

    try {
      await Promise.all(
        reordered.flatMap((category, i) =>
          category.order === i
            ? []
            : [adminApi.categories.update(category.id, { order: i })]
        )
      );
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      void load();
    }
  }

  function row(
    category: TicketCategory,
    siblings: TicketCategory[],
    index: number,
    parent?: TicketCategory
  ) {
    const children = parent ? [] : [...(category.children ?? [])].sort(byOrder);
    const isOpen = expanded.has(category.id);
    return (
      <div
        key={category.id}
        className={cn(
          "flex items-center gap-2 duration-300 animate-in fade-in",
          parent
            ? "ml-9 rounded-md px-3 py-1.5 hover:bg-secondary/60"
            : "rounded-lg border border-border bg-card px-3 py-2",
          !category.isActive && "opacity-60"
        )}
      >
        {!parent && (
          <button
            type="button"
            onClick={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(category.id)) next.delete(category.id);
                else next.add(category.id);
                return next;
              })
            }
            aria-expanded={isOpen}
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform duration-200",
                isOpen && "rotate-90"
              )}
            />
          </button>
        )}
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 truncate",
            parent ? "text-sm" : "font-medium",
            !category.isActive && "text-muted-foreground"
          )}
        >
          <span className="truncate">{pickLocalized(category.name, locale)}</span>
          {(() => {
            const severity = severities.find((s) => s.id === category.severityId);
            return severity ? <SeverityBadge severity={severity} /> : null;
          })()}
        </span>
        {!parent && children.length > 0 && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            {children.length}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={index === 0}
            onClick={() => move(siblings, index, -1)}
            aria-label={t("moveUp")}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={index === siblings.length - 1}
            onClick={() => move(siblings, index, 1)}
            aria-label={t("moveDown")}
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Switch
            checked={category.isActive}
            onCheckedChange={(value) => toggleActive(category, value)}
            aria-label={t("activeSwitch")}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={tc("edit")}>
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {!parent && (
                <DropdownMenuItem
                  onClick={() =>
                    setEditState({ mode: "create-child", parent: category })
                  }
                >
                  <Plus className="size-4" />
                  {t("createSubcategory")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setEditState({ mode: "rename", category })}
              >
                <Settings2 className="size-4" />
                {t("configure")}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleting(category)}
              >
                <Trash2 className="size-4" />
                {tc("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  const createButton = (
    <Button
      onClick={() => setEditState({ mode: "create-root" })}
      className="gap-2"
    >
      <Plus className="size-4" />
      {t("createCategory")}
    </Button>
  );

  return (
    <div className={embedded ? undefined : "mx-auto max-w-3xl"}>
      {embedded ? (
        <div className="mb-4 flex justify-end">{createButton}</div>
      ) : (
        <PageHeader title={t("title")} description={t("description")}>
          {createButton}
        </PageHeader>
      )}

      {!tree ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <FolderTree className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tree.map((category, i) => {
            const children = [...(category.children ?? [])].sort(byOrder);
            const isOpen = expanded.has(category.id);
            return (
              <div key={category.id} className="flex flex-col gap-0.5">
                {row(category, tree, i)}
                {isOpen &&
                  children.map((child, j) => row(child, children, j, category))}
              </div>
            );
          })}
        </div>
      )}

      <CategoryFormDialog
        state={editState}
        severities={severities}
        onClose={() => setEditState(null)}
        onSaved={() => {
          setEditState(null);
          void load();
        }}
      />
      <CategoryDeleteDialog
        category={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          void load();
        }}
      />
    </div>
  );
}
