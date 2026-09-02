"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import type {
  Department,
  DictionaryItem,
  Equipment,
  Office,
  UserProfile,
} from "@/lib/api";
import { adminApi, equipmentApi, locationsApi } from "@/lib/api-authed";
import { useDebouncedValue } from "@/hooks/use-debounce";

const NONE = "__none__";

/** Создание/правка единицы оборудования */
export function EquipmentFormDialog({
  equipment,
  open,
  onClose,
  onSaved,
}: {
  /** null — режим создания */
  equipment: Equipment | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Equipment");
  const tc = useTranslations("Common");

  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [inventory, setInventory] = useState("");
  const [note, setNote] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [departmentId, setDepartmentId] = useState(NONE);
  const [categoryId, setCategoryId] = useState(NONE);
  const [statusId, setStatusId] = useState(NONE);
  const [responsible, setResponsible] = useState<{ id: string; name: string } | null>(
    null
  );

  const [offices, setOffices] = useState<Office[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<DictionaryItem[]>([]);
  const [statuses, setStatuses] = useState<DictionaryItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Инициализация полей и справочников при открытии
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация формы при открытии
    setName(equipment?.name ?? "");
    setSerial(equipment?.serialNumber ?? "");
    setInventory(equipment?.inventoryNumber ?? "");
    setNote(equipment?.note ?? "");
    setOfficeId(equipment?.office?.id ?? "");
    setDepartmentId(equipment?.department?.id ?? NONE);
    setCategoryId(equipment?.category?.id ?? NONE);
    setStatusId(equipment?.status?.id ?? NONE);
    setResponsible(
      equipment?.responsible
        ? { id: equipment.responsible.id, name: equipment.responsible.name }
        : null
    );
    void locationsApi.offices().then(setOffices).catch(() => {});
    void equipmentApi.categories().then(setCategories).catch(() => {});
    void equipmentApi.statuses().then(setStatuses).catch(() => {});
  }, [open, equipment]);

  // Отделы выбранного офиса
  useEffect(() => {
    if (!open || !officeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс отделов без офиса
      setDepartments([]);
      return;
    }
    let cancelled = false;
    void locationsApi
      .departments(officeId)
      .then((d) => !cancelled && setDepartments(d))
      .catch(() => !cancelled && setDepartments([]));
    return () => {
      cancelled = true;
    };
  }, [open, officeId]);

  async function save() {
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!officeId) {
      toast.error(t("officeRequired"));
      return;
    }
    setSaving(true);
    try {
      if (equipment) {
        await equipmentApi.update(equipment.id, {
          name: name.trim(),
          serialNumber: serial.trim(),
          inventoryNumber: inventory.trim(),
          note: note.trim(),
          officeId,
          departmentId: departmentId === NONE ? null : departmentId,
          categoryId: categoryId === NONE ? null : categoryId,
          statusId: statusId === NONE ? undefined : statusId,
          responsibleId: responsible ? responsible.id : null,
        });
      } else {
        await equipmentApi.create({
          name: name.trim(),
          serialNumber: serial.trim() || undefined,
          inventoryNumber: inventory.trim() || undefined,
          note: note.trim() || undefined,
          officeId,
          departmentId: departmentId === NONE ? undefined : departmentId,
          categoryId: categoryId === NONE ? undefined : categoryId,
          statusId: statusId === NONE ? undefined : statusId,
          responsibleId: responsible?.id,
        });
      }
      toast.success(equipment ? t("saved") : t("created"));
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1807")
        toast.error(t("responsibleNotFound"));
      else toast.error(t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  const dictItems = (list: DictionaryItem[], noneLabel: string) => (
    <SelectContent>
      <SelectItem value={NONE}>{noneLabel}</SelectItem>
      {list.map((it) => (
        <SelectItem key={it.id} value={it.id}>
          {it.name}
        </SelectItem>
      ))}
    </SelectContent>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{equipment ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formHint")}</DialogDescription>
        </DialogHeader>

        <div className="-mr-1 flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <Field label={t("name")}>
            <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("serialNumber")}>
              <Input value={serial} maxLength={120} onChange={(e) => setSerial(e.target.value)} />
            </Field>
            <Field label={t("inventoryNumber")}>
              <Input value={inventory} maxLength={120} onChange={(e) => setInventory(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("office")}>
              <Select
                value={officeId}
                items={Object.fromEntries(offices.map((o) => [o.id, o.name]))}
                onValueChange={(v) => {
                  setOfficeId(v ?? "");
                  setDepartmentId(NONE);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("officePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("department")}>
              <Select
                value={departmentId}
                items={{
                  [NONE]: t("none"),
                  ...Object.fromEntries(departments.map((d) => [d.id, d.name])),
                }}
                onValueChange={(v) => setDepartmentId(v ?? NONE)}
                disabled={!officeId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                {dictItems(departments, t("none"))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("category")}>
              <Select
                value={categoryId}
                items={{
                  [NONE]: t("none"),
                  ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
                }}
                onValueChange={(v) => setCategoryId(v ?? NONE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                {dictItems(categories, t("none"))}
              </Select>
            </Field>
            <Field label={t("status")}>
              <Select
                value={statusId}
                items={{
                  [NONE]: t("statusDefault"),
                  ...Object.fromEntries(statuses.map((s) => [s.id, s.name])),
                }}
                onValueChange={(v) => setStatusId(v ?? NONE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                {dictItems(statuses, t("statusDefault"))}
              </Select>
            </Field>
          </div>

          <Field label={t("responsible")}>
            <ResponsiblePicker value={responsible} onChange={setResponsible} />
          </Field>

          <Field label={t("note")}>
            <textarea
              value={note}
              maxLength={2000}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Spinner className="size-4" /> : tc("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Поиск и выбор ответственного (пользователя) */
function ResponsiblePicker({
  value,
  onChange,
}: {
  value: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
}) {
  const t = useTranslations("Equipment");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);
  const [options, setOptions] = useState<UserProfile[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void adminApi.users
      .list({ search: debounced || undefined, limit: 15 })
      .then((p) => !cancelled && setOptions(p.items))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className="min-w-0 flex-1 justify-start font-normal"
            >
              <span className="truncate">
                {value ? value.name : t("responsiblePlaceholder")}
              </span>
            </Button>
          }
        />
        <PopoverContent align="start" className="w-72 p-2">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("responsibleSearch")}
              className="h-8 pl-8"
            />
          </div>
          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {options?.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange({ id: u.id, name: [u.name, u.lastName].filter(Boolean).join(" ") });
                  setOpen(false);
                }}
                className="flex flex-col rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
              >
                <span className="font-medium">
                  {[u.name, u.lastName].filter(Boolean).join(" ")}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{u.phone}</span>
              </button>
            ))}
            {options && options.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {t("responsibleNotFound")}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("clearResponsible")}
          onClick={() => onChange(null)}
          className="shrink-0 text-muted-foreground"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
