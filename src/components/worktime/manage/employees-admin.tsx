"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { UserPicker } from "@/components/common/user-picker";
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
  type LegalEntity,
  type Office,
  type Position,
  type SalaryType,
} from "@/lib/api";
import {
  checklistsApi,
  legalEntitiesApi,
  locationsApi,
  SessionExpiredError,
  worktimeApi,
} from "@/lib/api-authed";
import { formatTiyin, fullName, sumToTiyin, tiyinToSum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";

/** Экран 6 — трудоустройства: кто где работает и на каких условиях оплаты */
export function EmployeesAdmin() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState<Employment[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Employment | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        await worktimeApi.employments(activeOnly ? { active: true } : {})
      );
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
  }, [activeOnly]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">{t("employeesHint")}</p>
        <label className="ms-auto flex items-center gap-2 text-sm">
          <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
          {t("activeOnly")}
        </label>
        <Button className="gap-1.5" onClick={() => setEditing("new")}>
          <UserPlus className="size-4" />
          {t("addEmployee")}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-lg bg-accent-light">
              <Users className="size-6 text-primary" />
            </span>
            <p className="font-medium">{t("noEmployees")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => setEditing(emp)}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors hover:bg-secondary/40",
                !emp.active && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{fullName(emp.user)}</span>
                {emp.active ? (
                  <Badge className="bg-success-light text-success">
                    {t("active")}
                  </Badge>
                ) : (
                  <Badge className="bg-secondary text-muted-foreground">
                    {t("fired")}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {[emp.legalEntity?.name, emp.office?.name]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-sm">
                {emp.salaryType === "salary"
                  ? formatTiyin(emp.monthlySalaryTiyin ?? 0, locale)
                  : formatTiyin(emp.hourlyRateTiyin ?? 0, locale)}
                <span className="text-xs text-muted-foreground">
                  {" · "}
                  {emp.salaryType === "salary"
                    ? t("salaryTypeSalary")
                    : t("salaryTypeHourly")}
                </span>
              </p>
              {emp.positions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {emp.positions.map((p) => p.name).join(", ")}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <EmploymentDialog
          employment={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function EmploymentDialog({
  employment,
  onClose,
  onSaved,
}: {
  employment: Employment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();
  const editing = Boolean(employment);

  const [user, setUser] = useState<{ id: string; name: string } | null>(
    employment ? { id: employment.user.id, name: fullName(employment.user) } : null
  );
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [legalEntityId, setLegalEntityId] = useState(
    employment?.legalEntity?.id ?? ""
  );
  const [officeId, setOfficeId] = useState(employment?.office?.id ?? "");
  const [positionIds, setPositionIds] = useState<string[]>(
    employment?.positions.map((p) => p.id) ?? []
  );
  const [salaryType, setSalaryType] = useState<SalaryType>(
    employment?.salaryType ?? "salary"
  );
  const [amount, setAmount] = useState(
    employment
      ? String(
          tiyinToSum(
            employment.salaryType === "salary"
              ? employment.monthlySalaryTiyin
              : employment.hourlyRateTiyin
          )
        )
      : ""
  );
  const [hireDate, setHireDate] = useState(employment?.hireDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void legalEntitiesApi
      .list({ limit: 100 })
      .then((p) => setEntities(p.items))
      .catch(() => {});
    void locationsApi
      .offices()
      .then(setOffices)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!legalEntityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPositions([]);
      return;
    }
    void checklistsApi.positions
      .list(legalEntityId)
      .then(setPositions)
      .catch(() => setPositions([]));
  }, [legalEntityId]);

  async function save() {
    if (!user) {
      toast.error(t("selectEmployee"));
      return;
    }
    if (!legalEntityId || !officeId) {
      toast.error(t("saveError"));
      return;
    }
    const amountTiyin = sumToTiyin(amount);
    if (!amountTiyin) {
      toast.error(t("salaryAmountRequired"));
      return;
    }
    setSaving(true);
    try {
      const money =
        salaryType === "salary"
          ? { monthlySalaryTiyin: amountTiyin }
          : { hourlyRateTiyin: amountTiyin };
      if (employment) {
        await worktimeApi.updateEmployment(employment.id, {
          legalEntityId,
          officeId,
          positionIds,
          salaryType,
          ...money,
          hireDate: hireDate || undefined,
        });
      } else {
        await worktimeApi.createEmployment({
          userId: user.id,
          legalEntityId,
          officeId,
          positionIds,
          salaryType,
          ...money,
          hireDate: hireDate || undefined,
        });
      }
      toast.success(t("employmentSaved"));
      onSaved();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (e instanceof ApiError && e.code === "ER2401")
        toast.error(t("alreadyEmployed"));
      else if (e instanceof ApiError && e.code === "ER2402")
        toast.error(t("salaryAmountRequired"));
      else toast.error(t("saveError"));
      setSaving(false);
    }
  }

  async function fire() {
    if (!employment) return;
    setSaving(true);
    try {
      await worktimeApi.updateEmployment(employment.id, { active: false });
      toast.success(t("employmentSaved"));
      onSaved();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
      setSaving(false);
    }
  }

  function togglePosition(id: string) {
    setPositionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? fullName(employment!.user) : t("addEmployee")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {!editing && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("employee")}</Label>
              <UserPicker
                value={user}
                onChange={setUser}
                placeholder={t("selectEmployee")}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{t("employer")}</Label>
            <Select
              value={legalEntityId}
              items={Object.fromEntries(entities.map((e) => [e.id, e.name]))}
              onValueChange={(v) => setLegalEntityId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-52">
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("workplace")}</Label>
            <Select
              value={officeId}
              items={Object.fromEntries(offices.map((o) => [o.id, o.name]))}
              onValueChange={(v) => setOfficeId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-52">
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {positions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("positions")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {positions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePosition(p.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      positionIds.includes(p.id)
                        ? "border-primary bg-accent-light text-primary"
                        : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{t("salaryType")}</Label>
            <div className="flex gap-2">
              {(["salary", "hourly"] as SalaryType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSalaryType(type)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                    salaryType === type
                      ? "border-primary bg-accent-light text-primary"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {type === "salary"
                    ? t("salaryTypeSalary")
                    : t("salaryTypeHourly")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              {salaryType === "salary" ? t("monthlySalary") : t("hourlyRate")}
            </Label>
            <Input
              value={amount}
              inputMode="numeric"
              className="tabular-nums"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("hireDate")}</Label>
            <DatePicker
              value={hireDate}
              onChange={setHireDate}
              placeholder="—"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {editing && employment?.active ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={saving}
              onClick={() => void fire()}
            >
              {t("fireEmployee")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? <Spinner className="size-4" /> : t("save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
