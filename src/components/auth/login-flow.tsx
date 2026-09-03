"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { PhoneInput } from "@/components/auth/phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError, type OtpSession } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { saveSession } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Step = "phone" | "name" | "code";

/** «+998901234567» → «+998 90 123 45 67» */
function prettyPhone(phone: string) {
  const d = phone.replace(/\D/g, "").slice(3);
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

function useCountdown() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (deadline === null) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  return {
    remaining,
    start: (seconds: number) => setDeadline(Date.now() + seconds * 1000),
  };
}

export function LoginFlow() {
  const t = useTranslations("Auth");
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [digits, setDigits] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const resend = useCountdown();
  const verifyingRef = useRef(false);

  const phone = `+998${digits}`;

  function fail(message: string, shake = false) {
    setError(message);
    if (shake) {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    }
  }

  function errorText(e: unknown): string {
    if (e instanceof ApiError) {
      switch (e.code) {
        case "ER200":
          return t("errors.ER200");
        case "ER202":
          return e.data?.reason === "inactivity"
            ? t("errors.ER202inactivity")
            : t("errors.ER202");
        case "ER203":
          return t("errors.ER203");
        case "ER204":
          return t("errors.ER204", { seconds: e.retryAfter ?? 60 });
        case "ER205":
          return t("errors.ER205");
        case "ER206":
          return t("errors.ER206");
        case "ER101":
          return t("errors.invalidPhone");
        case "NETWORK":
          return t("errors.network");
      }
    }
    return t("errors.generic");
  }

  function goToCode(session: OtpSession) {
    setCode("");
    setError(null);
    setStep("code");
    resend.start(session.resendIn);
  }

  async function submitPhone() {
    if (digits.length !== 9) {
      fail(t("errors.invalidPhone"), true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      goToCode(await api.login(phone));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER201") {
        // Не зарегистрирован — переходим к регистрации (СМС не отправлялась)
        setError(null);
        setStep("name");
      } else if (e instanceof ApiError && e.code === "ER204") {
        // Кулдаун: код уже отправляли — сразу к вводу, с таймером
        goToCode({ phone, expiresIn: 300, resendIn: e.retryAfter ?? 60 });
      } else {
        fail(errorText(e), true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitName() {
    if (!name.trim()) {
      fail(t("errors.nameRequired"), true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      goToCode(await api.register(phone, name.trim()));
    } catch (e) {
      fail(errorText(e), true);
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(value: string) {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const tokens = await api.verify(phone, value);
      saveSession(tokens);
      logActivity({
        type: "auth.login",
        category: "Авторизация",
        description: "Вход в систему",
      });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setCode("");
      fail(errorText(e), true);
    } finally {
      verifyingRef.current = false;
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    setError(null);
    try {
      // Ветку (login/register) сервер восстановит сам; для новых номеров
      // повторяем register, для существующих — login
      const session =
        step === "code" && name
          ? await api.register(phone, name.trim())
          : await api.login(phone);
      goToCode(session);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER204") {
        resend.start(e.retryAfter ?? 60);
      }
      fail(errorText(e), true);
    } finally {
      setLoading(false);
    }
  }

  const errorLine = error && (
    <p className="text-xs leading-4 text-destructive">{error}</p>
  );

  return (
    <div
      key={step}
      className={cn(
        "flex w-full flex-col gap-6 duration-450 animate-in fade-in slide-in-from-bottom-4",
        shaking && "animate-shake"
      )}
    >
      {step === "phone" && (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-semibold leading-7">
              {t("phoneTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("phoneHint")}</p>
          </div>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitPhone();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="phone"
                className="text-sm font-medium text-muted-foreground"
              >
                {t("phoneLabel")}
              </Label>
              <PhoneInput
                id="phone"
                autoFocus
                value={digits}
                onChange={(v) => {
                  setDigits(v);
                  setError(null);
                }}
                invalid={!!error}
              />
              {errorLine}
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-[54px] text-base font-semibold"
            >
              {loading ? <Spinner /> : t("continue")}
            </Button>
          </form>
        </>
      )}

      {step === "name" && (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-semibold leading-7">
              {t("nameTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("nameHint", { phone: prettyPhone(phone) })}
            </p>
          </div>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitName();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="name"
                className="text-sm font-medium text-muted-foreground"
              >
                {t("nameLabel")}
              </Label>
              <Input
                id="name"
                autoFocus
                autoComplete="given-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                aria-invalid={!!error || undefined}
                className="h-[54px] rounded-md border-[1.5px] !text-base"
              />
              {errorLine}
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-[54px] text-base font-semibold"
            >
              {loading ? <Spinner /> : t("register")}
            </Button>
          </form>
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("back")}
          </Button>
        </>
      )}

      {step === "code" && (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-semibold leading-7">
              {t("codeTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("codeHint", { phone: prettyPhone(phone) })}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <InputOTP
              maxLength={6}
              autoFocus
              value={code}
              disabled={loading}
              onChange={(value) => {
                setCode(value);
                setError(null);
                if (value.length === 6) submitCode(value);
              }}
            >
              <InputOTPGroup className="gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className={cn(
                      "h-[58px] w-[50px] rounded-md border-0 bg-secondary text-lg font-semibold first:rounded-l-md last:rounded-r-md",
                      "data-[active=true]:bg-card data-[active=true]:ring-[1.5px] data-[active=true]:ring-primary",
                      error &&
                        "bg-accent-light ring-[1.5px] ring-destructive text-destructive"
                    )}
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {errorLine}
          </div>
          <div className="flex items-center gap-3">
            {resend.remaining > 0 ? (
              <p className="text-sm text-muted-foreground tabular-nums">
                {t("resendIn", { seconds: resend.remaining })}
              </p>
            ) : (
              <Button
                variant="link"
                size="sm"
                disabled={loading}
                onClick={resendCode}
                className="px-0 underline"
              >
                {t("resend")}
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("changePhone")}
          </Button>
        </>
      )}
    </div>
  );
}
