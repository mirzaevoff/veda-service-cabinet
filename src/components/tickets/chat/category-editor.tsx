"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, type Ticket, type TicketCategory } from "@/lib/api";
import { ticketsApi } from "@/lib/api-authed";
import { pickLocalized } from "@/lib/format";
import { getCached, setCached } from "@/lib/list-cache";

const byOrder = (a: TicketCategory, b: TicketCategory) => a.order - b.order;

/**
 * Категория обращения: текст, а для суппорта (tickets.answer) — с кнопкой
 * ручной смены (клиенты часто выбирают неверно, из-за чего плывут отчёты).
 */
export function CategoryEditor({
  ticket,
  canEdit,
  onUpdated,
}: {
  ticket: Ticket;
  canEdit: boolean;
  onUpdated: (ticket: Ticket) => void;
}) {
  const t = useTranslations("Tickets.chat");
  const te = useTranslations("Tickets.errors");
  const tc = useTranslations("Common");
  const locale = useLocale();

  const [open, setOpen] = useState(false);

  const label =
    pickLocalized(ticket.category, locale) +
    (ticket.subcategory ? ` · ${pickLocalized(ticket.subcategory, locale)}` : "");

  if (!canEdit) return <span>{label}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground"
        aria-label={t("changeCategory")}
      >
        <span className="truncate">{label}</span>
        <Pencil className="size-3 shrink-0 opacity-70" />
      </button>
      {open && (
        <CategoryDialog
          ticket={ticket}
          onClose={() => setOpen(false)}
          onSaved={(updated) => {
            setOpen(false);
            onUpdated(updated);
            toast.success(t("categoryChanged"));
          }}
          onError={(e) => {
            if (e instanceof ApiError && e.code === "ER402") toast.error(te("ER402"));
            else if (e instanceof ApiError && e.code === "ER403") toast.error(te("ER403"));
            else toast.error(te("generic"));
          }}
          t={t}
          tc={tc}
          locale={locale}
        />
      )}
    </>
  );
}

function CategoryDialog({
  ticket,
  onClose,
  onSaved,
  onError,
  t,
  tc,
  locale,
}: {
  ticket: Ticket;
  onClose: () => void;
  onSaved: (ticket: Ticket) => void;
  onError: (e: unknown) => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const [categories, setCategories] = useState<TicketCategory[] | null>(
    () => getCached<TicketCategory[]>("ticket-categories") ?? null
  );
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ticketsApi
      .categories()
      .then((items) => {
        setCategories(items);
        setCached("ticket-categories", items);
      })
      .catch(() => {});
  }, []);

  const roots = useMemo(
    () => (categories ?? []).filter((c) => c.isActive).sort(byOrder),
    [categories]
  );
  const subs = useMemo(() => {
    const root = roots.find((c) => c.id === categoryId);
    return (root?.children ?? []).filter((c) => c.isActive).sort(byOrder);
  }, [roots, categoryId]);

  async function save() {
    if (!categoryId) {
      onError(new Error("no category"));
      return;
    }
    setSaving(true);
    try {
      const updated = await ticketsApi.changeCategory(ticket.id, {
        categoryId,
        subcategoryId: subcategoryId || undefined,
      });
      onSaved(updated);
    } catch (e) {
      onError(e);
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("changeCategory")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("category")}</Label>
            <Select
              value={categoryId}
              items={Object.fromEntries(
                roots.map((c) => [c.id, pickLocalized(c.name, locale)])
              )}
              onValueChange={(v) => {
                setCategoryId(v ?? "");
                setSubcategoryId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-52">
                {roots.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {pickLocalized(c.name, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {subs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("subcategory")}</Label>
              <Select
                value={subcategoryId}
                items={Object.fromEntries(
                  subs.map((c) => [c.id, pickLocalized(c.name, locale)])
                )}
                onValueChange={(v) => setSubcategoryId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="w-auto min-w-52">
                  {subs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {pickLocalized(c.name, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={saving || !categoryId} onClick={() => void save()}>
            {saving ? <Spinner className="size-4" /> : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
