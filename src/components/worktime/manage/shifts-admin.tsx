"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarPlus, Moon, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { MonthPicker } from "@/components/common/month-picker";
import { DatePicker } from "@/components/common/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ApiError,
  type Employment,
  type Leave,
  type LeaveType,
  type ShiftAssignment,
  type ShiftTemplate,
} from "@/lib/api";
import { SessionExpiredError, worktimeApi } from "@/lib/api-authed";
import { currentMonthInTashkent, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { monthDays, weekdayOf } from "../worktime-format";

const COLORS = [
  "#A21500",
  "#1E6FD9",
  "#0E9F6E",
  "#C77700",
  "#7C3AED",
  "#0891B2",
];
const LEAVE_TYPES: LeaveType[] = ["vacation", "sick", "dayoff", "unpaid"];

/** Экраны 7–8 — смены (шаблоны) + график (назначения) + отсутствия */
export function ShiftsAdmin() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [month, setMonth] = useState(currentMonthInTashkent());
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [employees, setEmployees] = useState<Employment[]>([]);
  const [userId, setUserId] = useState("");
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [activeShift, setActiveShift] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [editTpl, setEditTpl] = useState<ShiftTemplate | "new" | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [addLeave, setAddLeave] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [tpls, emps] = await Promise.all([
        worktimeApi.shiftTemplates(),
        worktimeApi.employments({ active: true }),
      ]);
      setTemplates(tpls);
      setEmployees(emps);
      setActiveShift((prev) => prev ?? tpls[0]?.id ?? null);
      setUserId((prev) => prev || emps[0]?.user.id || "");
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        router.replace("/login");
        return;
      }
      toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGrid = useCallback(async () => {
    if (!userId) {
      setAssignments([]);
      setLeaves([]);
      return;
    }
    setGridLoading(true);
    try {
      const [asg, lvs] = await Promise.all([
        worktimeApi.assignments({ userId, month }),
        worktimeApi.leaves({
          userId,
          from: `${month}-01`,
          to: `${month}-31`,
        }),
      ]);
      setAssignments(asg);
      setLeaves(lvs);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    } finally {
      setGridLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGrid();
  }, [loadGrid]);

  const byDate = useMemo(
    () => new Map(assignments.map((a) => [a.date, a])),
    [assignments]
  );
  const leaveByDate = useMemo(() => {
    const map = new Map<string, Leave>();
    for (const lv of leaves) {
      for (const date of monthDays(month)) {
        if (date >= lv.from && date <= lv.to) map.set(date, lv);
      }
    }
    return map;
  }, [leaves, month]);

  async function toggleCell(date: string) {
    if (!userId) {
      toast.error(t("pickEmployeeFirst"));
      return;
    }
    const existing = byDate.get(date);
    try {
      if (existing) {
        await worktimeApi.unassign(existing.id);
      } else {
        if (!activeShift) return;
        await worktimeApi.assign({ userId, date, shiftId: activeShift });
      }
      await loadGrid();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
    }
  }

  const days = monthDays(month);
  const lead = days.length ? weekdayOf(days[0]) - 1 : 0;
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }).format(
      new Date(Date.UTC(2024, 0, 1 + i))
    )
  );

  if (loading) return <Skeleton className="h-72 w-full rounded-lg" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={userId}
          items={Object.fromEntries(
            employees.map((e) => [e.user.id, fullName(e.user)])
          )}
          onValueChange={(v) => setUserId(v ?? "")}
        >
          <SelectTrigger className="min-w-52">
            <SelectValue placeholder={t("selectEmployee")} />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-52">
            {employees.map((e) => (
              <SelectItem key={e.user.id} value={e.user.id}>
                {fullName(e.user)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MonthPicker value={month} onChange={setMonth} placeholder={t("month")} />
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowTemplates(true)}
          >
            {t("shiftTemplates")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setRangeOpen(true)}
          >
            <CalendarPlus className="size-4" />
            {t("assignRange")}
          </Button>
        </div>
      </div>

      {/* Палитра смен для «покраски» */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t("pickShift")}:</span>
        {templates.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("noShifts")}</span>
        ) : (
          templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setActiveShift(tpl.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                activeShift === tpl.id
                  ? "border-primary bg-accent-light text-primary"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: tpl.color ?? "#94a3b8" }}
              />
              {tpl.name}
              {tpl.crossMidnight && <Moon className="size-3" />}
            </button>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t("scheduleHint")}</p>

      {/* Сетка месяца */}
      {gridLoading ? (
        <Skeleton className="h-72 w-full rounded-lg" />
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekdayNames.map((name) => (
            <div
              key={name}
              className="pb-1 text-center text-xs text-muted-foreground"
            >
              {name}
            </div>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <div key={`lead-${i}`} />
          ))}
          {days.map((date) => {
            const asg = byDate.get(date);
            const lv = leaveByDate.get(date);
            return (
              <button
                key={date}
                type="button"
                onClick={() => void toggleCell(date)}
                className={cn(
                  "flex min-h-16 flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors hover:border-primary/50",
                  !asg && !lv && "bg-secondary/30"
                )}
              >
                <span className="text-xs text-muted-foreground">
                  {Number(date.slice(8))}
                </span>
                {asg ? (
                  <span className="flex items-start gap-1 text-[0.7rem] leading-tight font-medium">
                    <span
                      aria-hidden
                      className="mt-1 size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: asg.shift.color ?? "#94a3b8" }}
                    />
                    <span className="break-words">{asg.shift.name}</span>
                  </span>
                ) : lv ? (
                  <span className="rounded bg-accent-light px-1 py-0.5 text-[0.65rem] text-primary">
                    {t(`leaveType.${lv.type}`)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Отсутствия сотрудника */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">{t("leavesTitle")}</p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!userId}
            onClick={() => setAddLeave(true)}
          >
            <Plus className="size-4" />
            {t("addLeave")}
          </Button>
        </div>
        {leaves.length === 0 ? (
          <p className="rounded-lg border p-3 text-sm text-muted-foreground">
            {t("noLeaves")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {leaves.map((lv) => (
              <li
                key={lv.id}
                className="flex items-center justify-between gap-2 p-3 text-sm"
              >
                <span>
                  {t(`leaveType.${lv.type}`)}
                  <span className="text-muted-foreground">
                    {" · "}
                    {lv.from} — {lv.to}
                    {lv.paid ? ` · ${t("leavePaid")}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={t("removeLeave")}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    try {
                      await worktimeApi.removeLeave(lv.id);
                      await loadGrid();
                    } catch {
                      toast.error(t("saveError"));
                    }
                  }}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showTemplates && (
        <TemplatesDialog
          templates={templates}
          onClose={() => setShowTemplates(false)}
          onEdit={(tpl) => setEditTpl(tpl)}
          onChanged={loadBase}
        />
      )}
      {editTpl && (
        <TemplateDialog
          template={editTpl === "new" ? null : editTpl}
          onClose={() => setEditTpl(null)}
          onSaved={async () => {
            setEditTpl(null);
            await loadBase();
          }}
        />
      )}
      {addLeave && userId && (
        <LeaveDialog
          userId={userId}
          onClose={() => setAddLeave(false)}
          onSaved={async () => {
            setAddLeave(false);
            await loadGrid();
          }}
        />
      )}
      {rangeOpen && (
        <RangeDialog
          userId={userId}
          templates={templates}
          month={month}
          onClose={() => setRangeOpen(false)}
          onSaved={async () => {
            setRangeOpen(false);
            await loadGrid();
          }}
        />
      )}
    </div>
  );
}

function TemplatesDialog({
  templates,
  onClose,
  onEdit,
  onChanged,
}: {
  templates: ShiftTemplate[];
  onClose: () => void;
  onEdit: (tpl: ShiftTemplate | "new") => void;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();

  async function remove(id: string) {
    try {
      await worktimeApi.removeShiftTemplate(id);
      await onChanged();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (e instanceof ApiError) toast.error(t("shiftInUse"));
      else toast.error(t("saveError"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shiftTemplates")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center gap-2 rounded-lg border p-2.5"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: tpl.color ?? "#94a3b8" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {tpl.name}
                  {tpl.crossMidnight && (
                    <Moon className="ms-1 inline size-3 text-muted-foreground" />
                  )}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {tpl.startTime}–{tpl.endTime}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={tc("edit")}
                onClick={() => onEdit(tpl)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={tc("delete")}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => void remove(tpl.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("close")}
          </Button>
          <Button className="gap-1.5" onClick={() => onEdit("new")}>
            <Plus className="size-4" />
            {t("addShift")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({
  template,
  onClose,
  onSaved,
}: {
  template: ShiftTemplate | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [name, setName] = useState(template?.name ?? "");
  const [startTime, setStartTime] = useState(template?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(template?.endTime ?? "18:00");
  const [breakMinutes, setBreakMinutes] = useState(
    template?.breakMinutes != null ? String(template.breakMinutes) : ""
  );
  const [crossMidnight, setCrossMidnight] = useState(
    template?.crossMidnight ?? false
  );
  const [color, setColor] = useState(template?.color ?? COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error(t("saveError"));
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        startTime,
        endTime,
        breakMinutes: breakMinutes.trim() ? Number(breakMinutes) : undefined,
        crossMidnight,
        color,
      };
      if (template) await worktimeApi.updateShiftTemplate(template.id, body);
      else await worktimeApi.createShiftTemplate(body);
      toast.success(t("shiftSaved"));
      await onSaved();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{template ? t("editShift") : t("addShift")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("shiftName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("startTime")}</Label>
              <Input
                type="time"
                value={startTime}
                className="tabular-nums"
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("endTime")}</Label>
              <Input
                type="time"
                value={endTime}
                className="tabular-nums"
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("breakMinutes")}</Label>
            <Input
              value={breakMinutes}
              inputMode="numeric"
              className="tabular-nums"
              onChange={(e) => setBreakMinutes(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={crossMidnight} onCheckedChange={setCrossMidnight} />
            {t("crossMidnight")}
          </label>
          <div className="flex flex-col gap-1.5">
            <Label>{t("color")}</Label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-6 rounded-full border-2 transition-transform",
                    color === c
                      ? "scale-110 border-foreground"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDialog({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [type, setType] = useState<LeaveType>("vacation");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paid, setPaid] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // отпуск/больничный оплачиваются по умолчанию, отгул/без содержания — нет
  function onType(value: LeaveType) {
    setType(value);
    setPaid(value === "vacation" || value === "sick");
  }

  async function save() {
    if (!from || !to) {
      toast.error(t("saveError"));
      return;
    }
    setSaving(true);
    try {
      await worktimeApi.createLeave({
        userId,
        type,
        from,
        to,
        paid,
        note: note.trim() || undefined,
      });
      toast.success(t("leaveSaved"));
      await onSaved();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("addLeave")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("leavesTitle")}</Label>
            <Select
              value={type}
              items={Object.fromEntries(
                LEAVE_TYPES.map((lt) => [lt, t(`leaveType.${lt}`)])
              )}
              onValueChange={(v) => onType((v ?? "vacation") as LeaveType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-44">
                {LEAVE_TYPES.map((lt) => (
                  <SelectItem key={lt} value={lt}>
                    {t(`leaveType.${lt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("from")}</Label>
              <DatePicker value={from} onChange={setFrom} placeholder="—" future />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("to")}</Label>
              <DatePicker value={to} onChange={setTo} placeholder="—" future />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={paid} onCheckedChange={setPaid} />
            {t("leavePaid")}
          </label>
          <div className="flex flex-col gap-1.5">
            <Label>{t("leaveNote")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Spinner className="size-4" /> : t("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RangeDialog({
  userId,
  templates,
  month,
  onClose,
  onSaved,
}: {
  userId: string;
  templates: ShiftTemplate[];
  month: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [shiftId, setShiftId] = useState(templates[0]?.id ?? "");
  const [from, setFrom] = useState(`${month}-01`);
  const [to, setTo] = useState("");
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!userId) {
      toast.error(t("pickEmployeeFirst"));
      return;
    }
    if (!shiftId || !from || !to) {
      toast.error(t("saveError"));
      return;
    }
    setSaving(true);
    try {
      await worktimeApi.assignRange({
        userId,
        from,
        to,
        shiftId,
        weekdays: weekdaysOnly ? [1, 2, 3, 4, 5] : undefined,
      });
      toast.success(t("assignedSaved"));
      await onSaved();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("assignRange")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("pickShift")}</Label>
            <Select
              value={shiftId}
              items={Object.fromEntries(templates.map((x) => [x.id, x.name]))}
              onValueChange={(v) => setShiftId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-44">
                {templates.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("from")}</Label>
              <DatePicker value={from} onChange={setFrom} placeholder="—" future />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("to")}</Label>
              <DatePicker value={to} onChange={setTo} placeholder="—" future />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={weekdaysOnly} onCheckedChange={setWeekdaysOnly} />
            {t("weekdaysOnly")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
