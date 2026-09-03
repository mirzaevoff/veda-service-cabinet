"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Ban, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/common/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { ApiError, type Role, type UserProfile } from "@/lib/api";
import { adminApi } from "@/lib/api-authed";
import { logActivity } from "@/lib/activity-log";
import { PERMISSIONS } from "@/lib/permissions";
import { fullName, pickLocalized } from "@/lib/format";
import { UserSessions } from "./user-sessions";

export function UserDrawer({
  user,
  roles,
  onClose,
  onChanged,
}: {
  user: UserProfile | null;
  roles: Role[];
  onClose: () => void;
  onChanged: (user: UserProfile) => void;
}) {
  const t = useTranslations("AdminUsers");
  const locale = useLocale();
  const { user: me, can } = useCurrentUser();
  const [roleId, setRoleId] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс формы при смене пользователя
    setRoleId(user?.role.id ?? "");
    setName(user?.name ?? "");
    setLastName(user?.lastName ?? "");
    setBirthDate(user?.birthDate ?? "");
  }, [user]);

  if (!user) return null;

  const isSelf = me?.id === user.id;
  const canManage = can(PERMISSIONS.usersManage) && !isSelf;
  const blocked = user.status === "blocked";

  function errorText(e: unknown) {
    if (e instanceof ApiError && e.code === "ER210") return t("cantEditSelf");
    if (e instanceof ApiError && e.code === "NETWORK")
      return t("errors.network");
    return t("errors.generic");
  }

  const profileChanged =
    name.trim() !== user.name ||
    lastName.trim() !== user.lastName ||
    (birthDate || null) !== user.birthDate;

  async function saveProfile() {
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await adminApi.users.update(user!.id, {
        name: name.trim(),
        lastName: lastName.trim(),
        birthDate: birthDate || null,
      });
      logActivity({
        type: "user.profile.update",
        category: "Пользователи",
        description: "Изменение анкеты пользователя",
        targetType: "user",
        targetId: user!.id,
      });
      onChanged(updated);
      toast.success(t("profileSaved"));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveRole() {
    setBusy(true);
    try {
      const updated = await adminApi.users.update(user!.id, { roleId });
      logActivity({
        type: "user.role.change",
        category: "Пользователи",
        description: "Смена роли пользователя",
        targetType: "user",
        targetId: user!.id,
        meta: { roleId },
      });
      onChanged(updated);
      toast.success(t("roleSaved"));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    setBusy(true);
    try {
      const updated = await adminApi.users.update(user!.id, {
        status: blocked ? "active" : "blocked",
      });
      logActivity({
        type: blocked ? "user.unblock" : "user.block",
        targetType: "user",
        targetId: user!.id,
      });
      onChanged(updated);
      toast.success(t(blocked ? "unblocked" : "blockedToast"));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
      setConfirmBlock(false);
    }
  }

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent-light text-base font-semibold text-primary">
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            {fullName(user)}
          </SheetTitle>
          <SheetDescription>{user.phone}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{pickLocalized(user.role.title, locale) || user.role.slug}</Badge>
            <Badge
              variant="secondary"
              className={
                blocked
                  ? "bg-destructive/10 text-destructive"
                  : "bg-success-light text-success"
              }
            >
              {t(blocked ? "statusBlocked" : "statusActive")}
            </Badge>
            {isSelf && (
              <Badge variant="outline">{t("you")}</Badge>
            )}
          </div>

          {blocked && user.blockReason && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {t(
                user.blockReason === "inactivity"
                  ? "blockReasonInactivity"
                  : "blockReasonManual"
              )}
            </p>
          )}

          <div className="text-sm text-muted-foreground">
            {t("registered", {
              date: new Intl.DateTimeFormat(locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(user.createdAt)),
            })}
          </div>

          {canManage && (
            <>
              <Separator />

              <div className="flex flex-col gap-3">
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("profileSection")}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={name}
                    maxLength={100}
                    placeholder={t("nameLabel")}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    value={lastName}
                    maxLength={100}
                    placeholder={t("lastNameLabel")}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <DatePicker
                  value={birthDate}
                  onChange={setBirthDate}
                  placeholder={t("birthDateLabel")}
                />
                <Button
                  size="sm"
                  className="self-start"
                  disabled={savingProfile || !name.trim() || !profileChanged}
                  onClick={saveProfile}
                >
                  {savingProfile ? <Spinner className="size-4" /> : t("save")}
                </Button>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  {t("changeRole")}
                </Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={roleId}
                    items={Object.fromEntries(
                      roles.map((r) => [r.id, pickLocalized(r.title, locale) || r.slug])
                    )}
                    onValueChange={(v) => setRoleId(v as string)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {pickLocalized(r.title, locale) || r.slug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={busy || roleId === user.role.id}
                    onClick={saveRole}
                  >
                    {busy ? <Spinner className="size-4" /> : t("save")}
                  </Button>
                </div>
              </div>

              <Separator />

              {blocked ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={toggleBlock}
                  className="gap-2 self-start"
                >
                  <ShieldCheck className="size-4" />
                  {t("unblock")}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setConfirmBlock(true)}
                  className="gap-2 self-start"
                >
                  <Ban className="size-4" />
                  {t("block")}
                </Button>
              )}
            </>
          )}

          {isSelf && (
            <p className="text-xs text-muted-foreground">{t("cantEditSelf")}</p>
          )}

          <Separator />

          <UserSessions userId={user.id} />
        </div>

        <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("blockConfirmTitle", { name: user.name })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("blockConfirmText")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={toggleBlock}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {t("block")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
