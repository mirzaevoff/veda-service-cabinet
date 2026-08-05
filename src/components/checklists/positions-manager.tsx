"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BriefcaseBusiness, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { Position } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { checklistsApi } from "@/lib/api-authed";

/** Справочник должностей ЮЛ (owner/ТП) */
export function PositionsManager({
  entityId,
  positions,
  onChanged,
}: {
  entityId: string;
  positions: Position[];
  onChanged: () => void;
}) {
  const t = useTranslations("Checklists.positions");

  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await checklistsApi.positions.create(entityId, title.trim());
      setTitle("");
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER901") setError(t("duplicate"));
      else setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    if (!editingId || !editTitle.trim()) return;
    setBusy(true);
    try {
      await checklistsApi.positions.update(editingId, editTitle.trim());
      setEditingId(null);
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER901") toast.error(t("duplicate"));
      else toast.error(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function archive(position: Position) {
    setBusy(true);
    try {
      await checklistsApi.positions.archive(position.id);
      toast.success(t("archived"));
      onChanged();
    } catch {
      toast.error(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium text-muted-foreground">
        {t("title")}
      </Label>

      {positions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {positions.map((position) => (
            <div
              key={position.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <BriefcaseBusiness className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
              {editingId === position.id ? (
                <>
                  <Input
                    value={editTitle}
                    maxLength={100}
                    autoFocus
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void rename()}
                    className="h-8 min-w-0 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label={t("saveRename")}
                    onClick={() => void rename()}
                    className="text-primary"
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("cancelRename")}
                    onClick={() => setEditingId(null)}
                    className="text-muted-foreground"
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {position.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label={t("rename")}
                    onClick={() => {
                      setEditingId(position.id);
                      setEditTitle(position.title);
                    }}
                    className="text-muted-foreground"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label={t("archive")}
                    onClick={() => void archive(position)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Input
          value={title}
          maxLength={100}
          placeholder={t("placeholder")}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={busy || !title.trim()} className="gap-2">
          {busy ? <Spinner className="size-4" /> : <Plus className="size-4" />}
          {t("add")}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
