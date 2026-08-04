"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  LogOut,
  Monitor,
  Smartphone,
  TabletSmartphone,
  X,
} from "lucide-react";
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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { PhoneInput } from "@/components/auth/phone-input";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { AuthSession } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { profileApi, usersApi } from "@/lib/api-authed";
import { clearSession } from "@/lib/auth";
import { formatRelativeTime } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function DeviceIcon({ platform }: { platform?: string }) {
  const Icon =
    platform === "ios" || platform === "android"
      ? Smartphone
      : platform === "web"
        ? Monitor
        : TabletSmartphone;
  return <Icon className="size-4.5 text-primary" strokeWidth={1.75} />;
}

export function ProfileView() {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const router = useRouter();
  const { user, reload } = useCurrentUser();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [phoneDialog, setPhoneDialog] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"phone" | "code">("phone");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<AuthSession[] | null>(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация формы с профилем
    setName(user?.name ?? "");
    setLastName(user?.lastName ?? "");
    setBirthDate(user?.birthDate ?? "");
  }, [user]);

  useEffect(() => {
    profileApi.sessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  if (!user) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  const personalChanged =
    !!user &&
    (name.trim() !== user.name ||
      lastName.trim() !== user.lastName ||
      (birthDate || null) !== user.birthDate);

  async function savePersonal() {
    if (!user || !name.trim() || !personalChanged) return;
    // PATCH частичный: отправляем только изменённое
    const patch: { name?: string; lastName?: string; birthDate?: string | null } = {};
    if (name.trim() !== user.name) patch.name = name.trim();
    if (lastName.trim() !== user.lastName) patch.lastName = lastName.trim();
    if ((birthDate || null) !== user.birthDate) patch.birthDate = birthDate || null;
    setSavingName(true);
    try {
      await usersApi.updateMe(patch);
      await reload();
      toast.success(t("nameSaved"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setSavingName(false);
    }
  }

  async function submitPhone() {
    if (digits.length !== 9) {
      setPhoneError(t("invalidPhone"));
      return;
    }
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      await profileApi.changePhone(`+998${digits}`);
      setCode("");
      setPhoneStep("code");
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER200")
        setPhoneError(t("phoneTaken"));
      else if (e instanceof ApiError && e.code === "ER204")
        setPhoneError(t("cooldown", { seconds: e.retryAfter ?? 60 }));
      else setPhoneError(t("genericError"));
    } finally {
      setPhoneBusy(false);
    }
  }

  async function submitCode(value: string) {
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      await profileApi.changePhoneVerify(`+998${digits}`, value);
      await reload();
      setPhoneDialog(false);
      setPhoneStep("phone");
      setDigits("");
      toast.success(t("phoneSaved"));
    } catch {
      setCode("");
      setPhoneError(t("badCode"));
    } finally {
      setPhoneBusy(false);
    }
  }

  function terminate(session: AuthSession) {
    profileApi
      .terminateSession(session.id)
      .then(() => {
        setSessions((prev) => prev?.filter((s) => s.id !== session.id) ?? prev);
        toast.success(t("sessionTerminated"));
      })
      .catch(() => toast.error(t("genericError")));
  }

  async function logoutEverywhere() {
    try {
      await profileApi.logoutAll();
    } catch {
      // всё равно чистим локально
    }
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Личные данные */}
      <section className="flex flex-col gap-4 rounded-lg border border-border p-5 duration-450 animate-in fade-in slide-in-from-bottom-4">
        <h3 className="font-semibold">{t("nameSection")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name" className="text-sm font-medium text-muted-foreground">
              {t("nameLabel")}
            </Label>
            <Input
              id="profile-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-lastname" className="text-sm font-medium text-muted-foreground">
              {t("lastNameLabel")}
            </Label>
            <Input
              id="profile-lastname"
              value={lastName}
              maxLength={100}
              placeholder={t("lastNameOptional")}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-birthdate" className="text-sm font-medium text-muted-foreground">
              {t("birthDateLabel")}
            </Label>
            <Input
              id="profile-birthdate"
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={savePersonal}
          disabled={savingName || !name.trim() || !personalChanged}
          className="self-start"
        >
          {savingName ? <Spinner className="size-4" /> : t("save")}
        </Button>
      </section>

      {/* Телефон */}
      <section className="flex flex-col gap-3 rounded-lg border border-border p-5 duration-450 animate-in fade-in slide-in-from-bottom-4 [animation-delay:80ms] [animation-fill-mode:backwards]">
        <h3 className="font-semibold">{t("phoneSection")}</h3>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm tabular-nums">{user.phone}</span>
          <Button variant="outline" size="sm" onClick={() => setPhoneDialog(true)}>
            {t("changePhone")}
          </Button>
        </div>
      </section>

      {/* Сессии */}
      <section className="flex flex-col gap-3 rounded-lg border border-border p-5 duration-450 animate-in fade-in slide-in-from-bottom-4 [animation-delay:160ms] [animation-fill-mode:backwards]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t("sessionsSection")}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmLogoutAll(true)}
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />
            {t("logoutAll")}
          </Button>
        </div>

        {!sessions ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 rounded-md" />
            <Skeleton className="h-14 rounded-md" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border border-border px-3 py-2.5",
                  s.current && "border-primary/40 bg-accent-light/30"
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light">
                  <DeviceIcon platform={s.device?.platform} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {s.device?.name || t("unknownDevice")}
                    {s.current && (
                      <Badge variant="secondary" className="bg-accent-light text-primary">
                        {t("currentSession")}
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("lastActive", {
                      time: formatRelativeTime(s.lastActiveAt, locale),
                    })}
                  </span>
                </div>
                {!s.current && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("terminate")}
                    onClick={() => terminate(s)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Диалог смены номера */}
      <Dialog
        open={phoneDialog}
        onOpenChange={(open) => {
          setPhoneDialog(open);
          if (!open) {
            setPhoneStep("phone");
            setDigits("");
            setPhoneError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("changePhone")}</DialogTitle>
            <DialogDescription>
              {phoneStep === "phone"
                ? t("changePhoneHint")
                : t("codeHint", {
                    phone: `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`,
                  })}
            </DialogDescription>
          </DialogHeader>

          {phoneStep === "phone" ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitPhone();
              }}
            >
              <PhoneInput
                autoFocus
                value={digits}
                onChange={(v) => {
                  setDigits(v);
                  setPhoneError(null);
                }}
                invalid={!!phoneError}
              />
              {phoneError && (
                <p className="text-xs text-destructive">{phoneError}</p>
              )}
              <Button type="submit" disabled={phoneBusy} className="h-[54px] text-base font-semibold">
                {phoneBusy ? <Spinner /> : t("sendCode")}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <InputOTP
                maxLength={6}
                autoFocus
                value={code}
                disabled={phoneBusy}
                onChange={(value) => {
                  setCode(value);
                  setPhoneError(null);
                  if (value.length === 6) void submitCode(value);
                }}
              >
                <InputOTPGroup className="gap-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className={cn(
                        "h-[58px] w-[46px] rounded-md border-0 bg-secondary text-lg font-semibold first:rounded-l-md last:rounded-r-md",
                        "data-[active=true]:bg-card data-[active=true]:ring-[1.5px] data-[active=true]:ring-primary",
                        phoneError &&
                          "bg-accent-light ring-[1.5px] ring-destructive text-destructive"
                      )}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {phoneError && (
                <p className="text-xs text-destructive">{phoneError}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Подтверждение выхода со всех устройств */}
      <AlertDialog open={confirmLogoutAll} onOpenChange={setConfirmLogoutAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("logoutAllConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("logoutAllConfirmText")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={logoutEverywhere}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("logoutAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
