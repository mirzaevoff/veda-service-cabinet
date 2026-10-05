"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, ArchiveRestore, Check, Pencil, Plus, Tags, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { ApiError, type CashCategory, type CashCategoryDirection } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const DIRECTIONS: CashCategoryDirection[] = ["in", "out", "both"];

export const directionBadgeCls: Record<CashCategoryDirection, string> = {
  in: "bg-success-light text-success",
  out: "bg-accent-light text-primary",
  both: "bg-secondary text-muted-foreground",
};

/** Экран 5: статьи движения денег — справочник общий на систему, только архив */
export function BankCategories({
  categories,
  onChanged,
}: {
  categories: CashCategory[] | null;
  onChanged: () => void;
}) {
  const t = useTranslations("Bank.categories");
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.bankManage);

  const [name, setName] = useState("");
  const [direction, setDirection] = useState<CashCategoryDirection>("out");
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  async function create() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await bankApi.categories.create({ name: name.trim(), direction });
      toast.success(t("created"));
      setName("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === "ER1211" ? t("duplicate") : t("error"));
    } finally {
      setCreating(false);
    }
  }

  const list = (categories ?? []).filter((c) => showArchived || !c.archived);
  const archivedCount = (categories ?? []).filter((c) => c.archived).length;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
          <Input
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void create()}
            placeholder={t("namePlaceholder")}
            className="min-w-52 flex-1"
          />
          <DirectionToggle value={direction} onChange={setDirection} />
          <Button onClick={() => void create()} disabled={!name.trim() || creating} className="gap-2">
            {creating ? <Spinner className="size-4" /> : <Plus className="size-4" />}
            {t("add")}
          </Button>
        </div>
      )}

      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="self-start text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {showArchived ? t("hideArchived") : t("showArchived", { count: archivedCount })}
        </button>
      )}

      {categories === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <Tags className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {list.map((c) => (
            <CategoryRow key={c.id} category={c} canManage={canManage} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function DirectionToggle({
  value,
  onChange,
}: {
  value: CashCategoryDirection;
  onChange: (v: CashCategoryDirection) => void;
}) {
  const t = useTranslations("Bank.categories");
  return (
    <div className="flex rounded-lg border border-border p-0.5">
      {DIRECTIONS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === d ? directionBadgeCls[d] : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(`direction.${d}`)}
        </button>
      ))}
    </div>
  );
}

function CategoryRow({
  category,
  canManage,
  onChanged,
}: {
  category: CashCategory;
  canManage: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("Bank.categories");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [direction, setDirection] = useState(category.direction);
  const [busy, setBusy] = useState(false);

  async function patch(body: Parameters<typeof bankApi.categories.update>[1]) {
    setBusy(true);
    try {
      await bankApi.categories.update(category.id, body);
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === "ER1211" ? t("duplicate") : t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Input
          value={name}
          autoFocus
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          className="h-8 min-w-48 flex-1"
        />
        <DirectionToggle value={direction} onChange={setDirection} />
        <Button
          size="icon-sm"
          disabled={busy || !name.trim()}
          onClick={() =>
            void patch({
              ...(name.trim() !== category.name ? { name: name.trim() } : {}),
              ...(direction !== category.direction ? { direction } : {}),
            })
          }
          aria-label={t("save")}
        >
          {busy ? <Spinner className="size-4" /> : <Check className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setEditing(false);
            setName(category.name);
            setDirection(category.direction);
          }}
          aria-label={t("cancel")}
        >
          <X className="size-4" />
        </Button>
        {direction !== category.direction && (
          <p className="w-full text-xs text-muted-foreground">{t("directionChangeHint")}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", category.archived && "opacity-60")}>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</span>
      {category.archived && (
        <Badge variant="secondary" className="text-muted-foreground">
          {t("archived")}
        </Badge>
      )}
      <Badge variant="secondary" className={directionBadgeCls[category.direction]}>
        {t(`direction.${category.direction}`)}
      </Badge>
      {canManage && (
        <div className="flex items-center gap-0.5">
          {!category.archived && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(true)}
              aria-label={t("edit")}
              className="text-muted-foreground"
            >
              <Pencil className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => void patch({ archived: !category.archived })}
            aria-label={category.archived ? t("restore") : t("archive")}
            title={category.archived ? t("restore") : t("archive")}
            className="text-muted-foreground"
          >
            {category.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
