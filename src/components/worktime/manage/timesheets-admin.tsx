"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { MonthPicker } from "@/components/common/month-picker";
import { DatePicker } from "@/components/common/date-picker";
import {
  ApiError,
  type Timesheet,
  type TimesheetDay,
} from "@/lib/api";
import { SessionExpiredError, worktimeApi } from "@/lib/api-authed";
import {
  currentMonthInTashkent,
  formatMinutes,
  fullName,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { TimesheetGrid, TimesheetLegend } from "../timesheet-grid";
import { timesheetStatusStyle } from "../worktime-format";

/** Экран 9 — табели: сборка из явок, правка спорных дней и утверждение */
export function TimesheetsAdmin() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [month, setMonth] = useState(currentMonthInTashkent());
  const [items, setItems] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await worktimeApi.timesheets({ month }));
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
  }, [month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function generateAll() {
    setGenerating(true);
    try {
      await worktimeApi.generateTimesheet({ month, all: true });
      toast.success(t("generatedToast"));
      await load();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
    } finally {
      setGenerating(false);
    }
  }

  const open = items.find((ts) => ts.id === openId) ?? null;
  if (open) {
    return (
      <TimesheetDetail
        timesheet={open}
        onBack={() => setOpenId(null)}
        onChanged={load}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("tsheetsHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker value={month} onChange={setMonth} placeholder={t("month")} />
        <Button
          className="ms-auto gap-1.5"
          disabled={generating}
          onClick={() => void generateAll()}
        >
          {generating ? (
            <Spinner className="size-4" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {t("generateAll")}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-lg bg-accent-light">
              <ClipboardList className="size-6 text-primary" />
            </span>
            <p className="font-medium">{t("noTimesheets")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {items.map((ts) => (
            <button
              key={ts.id}
              type="button"
              onClick={() => setOpenId(ts.id)}
              className="flex items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{fullName(ts.user)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t("worked")}:{" "}
                  {formatMinutes(
                    ts.totals.workedMinutes ??
                      (ts.totals.workedHours != null
                        ? ts.totals.workedHours * 60
                        : null)
                  )}
                  {" · "}
                  {t("totals.late")}:{" "}
                  {ts.totals.lateMinutes
                    ? formatMinutes(ts.totals.lateMinutes)
                    : (ts.totals.lateCount ?? 0)}
                  {" · "}
                  {t("totals.absences")}: {ts.totals.absences ?? 0}
                </p>
              </div>
              <Badge className={timesheetStatusStyle(ts.status)}>
                {t(`timesheetStatus.${ts.status}`)}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TimesheetDetail({
  timesheet,
  onBack,
  onChanged,
}: {
  timesheet: Timesheet;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("Worktime");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [markDay, setMarkDay] = useState<TimesheetDay | null>(null);
  const approved = timesheet.status === "approved";

  async function act(fn: () => Promise<unknown>, ok: string, lockCode?: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await onChanged();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (lockCode && e instanceof ApiError && e.code === lockCode)
        toast.error(t("approveLocked"));
      else toast.error(t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("backToList")}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <p className="font-medium">{fullName(timesheet.user)}</p>
        </div>
        <Badge className={timesheetStatusStyle(timesheet.status)}>
          {t(`timesheetStatus.${timesheet.status}`)}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={busy || approved}
          onClick={() =>
            void act(
              () =>
                worktimeApi.generateTimesheet({
                  month: timesheet.month,
                  userId: timesheet.user.id,
                }),
              t("generatedToast"),
              "ER2408"
            )
          }
        >
          <RefreshCw className="size-4" />
          {t("rebuild")}
        </Button>
        {approved ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              void act(
                () => worktimeApi.reopenTimesheet(timesheet.id),
                t("timesheetReopened")
              )
            }
          >
            {t("reopen")}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void act(
                () => worktimeApi.approveTimesheet(timesheet.id),
                t("timesheetApproved")
              )
            }
          >
            {t("approve")}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{t("disputedHint")}</p>
      <TimesheetLegend />
      <TimesheetGrid
        timesheet={timesheet}
        onDayClick={approved ? undefined : (day) => setMarkDay(day)}
      />

      {markDay && (
        <ManualMarkDialog
          userId={timesheet.user.id}
          userName={fullName(timesheet.user)}
          day={markDay}
          onClose={() => setMarkDay(null)}
          onSaved={async () => {
            setMarkDay(null);
            await onChanged();
          }}
        />
      )}
    </div>
  );
}

function ManualMarkDialog({
  userId,
  userName,
  day,
  onClose,
  onSaved,
}: {
  userId: string;
  userName: string;
  day: TimesheetDay;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [type, setType] = useState<"in" | "out">("in");
  const [date, setDate] = useState(day.date);
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // Ташкент UTC+5 → ISO
      const at = new Date(`${date}T${time}:00+05:00`).toISOString();
      await worktimeApi.manualMark({
        userId,
        type,
        at,
        note: note.trim() || undefined,
      });
      // после ручной отметки — пересобрать день
      toast.success(t("marked"));
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
          <DialogTitle>{t("manualMarkFor", { name: userName })}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("markType")}</Label>
            <div className="flex gap-2">
              {(["in", "out"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                    type === v
                      ? "border-primary bg-accent-light text-primary"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {v === "in" ? t("markTypeIn") : t("markTypeOut")}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("markAt")}</Label>
              <DatePicker value={date} onChange={setDate} placeholder="—" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>&nbsp;</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("markNote")}</Label>
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
