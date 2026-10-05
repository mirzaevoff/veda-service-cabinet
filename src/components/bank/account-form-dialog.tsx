"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, Landmark, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { DatePicker } from "@/components/common/date-picker";
import {
  LegalEntityPicker,
  type PickedEntity,
} from "@/components/legal-entities/legal-entity-picker";
import { ApiError, type BankAccount } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { cn } from "@/lib/utils";
import { formatTiyin, parseSignedSumToTiyin, tiyinToSumInput } from "./bank-money";

type AccountType = "synced" | "manual-account" | "card";

/**
 * Экран 1: добавить счёт (синхронизируемый Капиталбанк / ручной счёт / карта)
 * или изменить ручной. У карты МФО нет — поля нет вовсе. Входящий остаток
 * у ручных обязателен: без него баланс разойдётся с банком.
 */
export function AccountFormDialog({
  open,
  account,
  entityName,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Правка ручного счёта/карты; null — создание */
  account: BankAccount | null;
  entityName?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Bank.accountForm");
  const tc = useTranslations("Common");
  const editing = !!account;

  const [type, setType] = useState<AccountType>("manual-account");
  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState("");
  const [number, setNumber] = useState("");
  const [entity, setEntity] = useState<PickedEntity | null>(null);
  const [opening, setOpening] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- инициализация при открытии */
    setError(null);
    setBusy(false);
    if (account) {
      setType(account.form === "card" ? "card" : "manual-account");
      setTitle(account.title);
      setBranch(account.branch);
      setNumber(account.account);
      setEntity(account.legalEntityId ? { id: account.legalEntityId, name: entityName ?? "" } : null);
      setOpening(tiyinToSumInput(account.openingBalanceTiyin));
      setOpeningDate(account.openingDate ?? "");
    } else {
      setType("manual-account");
      setTitle("");
      setBranch("");
      setNumber("");
      setEntity(null);
      setOpening("");
      setOpeningDate("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при открытии
  }, [open]);

  const isCard = type === "card";
  const isManual = type !== "synced";
  const openingTiyin = opening.trim() ? parseSignedSumToTiyin(opening) : null;

  function validate(): string | null {
    if (!title.trim()) return t("errors.title");
    if (!editing) {
      if (!isCard && !/^\d{5}$/.test(branch)) return t("errors.branch");
      if (!isCard && !/^\d{20}$/.test(number)) return t("errors.account");
      if (isCard && !number.trim()) return t("errors.cardNumber");
    }
    if (isManual) {
      if (openingTiyin === null) return t("errors.opening");
      if (!openingDate) return t("errors.openingDate");
    }
    return null;
  }

  async function save() {
    if (busyRef.current) return;
    const v = validate();
    if (v) return setError(v);
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (account) {
        const openingChanged =
          openingTiyin !== account.openingBalanceTiyin || openingDate !== (account.openingDate ?? "");
        await bankApi.accounts.update(account.id, {
          title: title.trim(),
          ...(entity?.id && entity.id !== account.legalEntityId ? { legalEntityId: entity.id } : {}),
          ...(openingChanged ? { openingBalanceTiyin: openingTiyin ?? 0, openingDate } : {}),
        });
        toast.success(t("updated"));
      } else {
        await bankApi.accounts.create({
          title: title.trim(),
          kind: isManual ? "manual" : "synced",
          form: isCard ? "card" : "account",
          ...(isCard ? {} : { branch }),
          account: number.trim(),
          ...(entity ? { legalEntityId: entity.id } : {}),
          ...(isManual ? { openingBalanceTiyin: openingTiyin ?? 0, openingDate } : {}),
        });
        toast.success(t("created"));
      }
      onSaved();
      onClose();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      if (code === "ER1203") setError(t("errors.duplicate"));
      else if (code === "ER1209") setError(t("errors.requisites"));
      else setError(t("errors.generic"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const types: { key: AccountType; icon: typeof Landmark }[] = [
    { key: "manual-account", icon: Landmark },
    { key: "card", icon: CreditCard },
    { key: "synced", icon: RefreshCw },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t(`typeHint.${type}`)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!editing && (
            <div className="grid grid-cols-3 gap-2">
              {types.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setType(key);
                    setError(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
                    type === key
                      ? "border-primary/40 bg-accent-light text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                  {t(`type.${key}`)}
                </button>
              ))}
            </div>
          )}

          <Field label={t("title")}>
            <Input
              value={title}
              maxLength={200}
              placeholder={isCard ? t("titlePlaceholderCard") : t("titlePlaceholder")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          {!editing &&
            (isCard ? (
              <Field label={t("cardNumber")} hint={t("cardNumberHint")}>
                <Input
                  value={number}
                  maxLength={40}
                  placeholder="****5444"
                  onChange={(e) => setNumber(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
            ) : (
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                <Field label={t("branch")}>
                  <Input
                    value={branch}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="01158"
                    onChange={(e) => setBranch(e.target.value.replace(/\D/g, ""))}
                    className="tabular-nums"
                  />
                </Field>
                <Field label={t("account")}>
                  <Input
                    value={number}
                    inputMode="numeric"
                    maxLength={20}
                    placeholder="20208000900000000001"
                    onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
                    className="tabular-nums"
                  />
                </Field>
              </div>
            ))}

          <Field label={t("entity")} hint={t("entityHint")}>
            <LegalEntityPicker
              value={entity}
              onChange={setEntity}
              placeholder={t("entityPlaceholder")}
              className="w-full"
            />
          </Field>

          {isManual && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3">
              <span className="text-sm font-medium">{t("openingTitle")}</span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <Input
                  value={opening}
                  inputMode="decimal"
                  placeholder="0"
                  onChange={(e) => setOpening(e.target.value)}
                  aria-invalid={opening.trim() !== "" && openingTiyin === null}
                  className="tabular-nums"
                />
                <DatePicker
                  recent
                  value={openingDate}
                  onChange={setOpeningDate}
                  placeholder={t("openingDate")}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {openingTiyin !== null
                  ? t("openingPreview", { sum: formatTiyin(openingTiyin) })
                  : isCard
                    ? t("openingHintCard")
                    : t("openingHint")}
              </span>
              {editing && <span className="text-xs text-warning">{t("openingEditWarning")}</span>}
            </div>
          )}

          {!editing && type === "synced" && (
            <p className="text-xs text-muted-foreground">{t("immutableHint")}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
