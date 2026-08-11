"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
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
import { ApiError, type LegalEntity } from "@/lib/api";
import { legalEntitiesApi } from "@/lib/api-authed";

interface FormState {
  taxId: string;
  name: string;
  rawName: string;
  establishment: string;
  bankCode: string;
  bank: string;
  bankAccount: string;
  address: string;
  directorLastName: string;
  directorFirstName: string;
  directorMiddleName: string;
  registrationDate: string;
}

const EMPTY: FormState = {
  taxId: "",
  name: "",
  rawName: "",
  establishment: "",
  bankCode: "",
  bank: "",
  bankAccount: "",
  address: "",
  directorLastName: "",
  directorFirstName: "",
  directorMiddleName: "",
  registrationDate: "",
};

function fromEntity(entity: LegalEntity): FormState {
  return {
    taxId: entity.taxId,
    name: entity.name,
    rawName: entity.rawName,
    establishment: entity.establishment,
    bankCode: entity.bankCode,
    bank: entity.bank,
    bankAccount: entity.bankAccount,
    address: entity.address,
    directorLastName: entity.director?.lastName ?? "",
    directorFirstName: entity.director?.firstName ?? "",
    directorMiddleName: entity.director?.middleName ?? "",
    registrationDate: entity.registrationDate ?? "",
  };
}

export function EntityFormDialog({
  open,
  entity,
  initialTaxId,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null — создание */
  entity: LegalEntity | null;
  /** Предзаполнить ИНН при создании (например, из запроса доступа) */
  initialTaxId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("LegalEntities");
  const isNew = !entity;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс формы при открытии
      setForm(
        entity
          ? fromEntity(entity)
          : { ...EMPTY, taxId: initialTaxId ?? "" }
      );
      setError(null);
    }
  }, [open, entity, initialTaxId]);

  const taxIdValid = /^(\d{9}|\d{14})$/.test(form.taxId);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function lookup() {
    if (!taxIdValid) {
      setError(t("taxIdFormat"));
      return;
    }
    setLookingUp(true);
    setError(null);
    try {
      const found = await legalEntitiesApi.lookup(form.taxId);
      setForm((prev) => ({
        ...prev,
        name: found.name,
        rawName: found.rawName,
        bankCode: found.bankCode,
        bank: found.bank,
        bankAccount: found.bankAccount,
        address: found.address,
        directorLastName: found.director?.lastName ?? "",
        directorFirstName: found.director?.firstName ?? "",
        directorMiddleName: found.director?.middleName ?? "",
        registrationDate: found.registrationDate ?? "",
      }));
      toast.success(t("lookupDone"));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER703") setError(t("errors.ER703"));
      else if (e instanceof ApiError && e.code === "ER702")
        setError(t("errors.ER702"));
      else if (e instanceof ApiError && e.code === "ER101")
        setError(t("taxIdFormat"));
      else setError(t("errors.generic"));
    } finally {
      setLookingUp(false);
    }
  }

  async function save() {
    if (isNew && !taxIdValid) {
      setError(t("taxIdFormat"));
      return;
    }
    if (!form.name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const director =
      form.directorLastName.trim() || form.directorFirstName.trim()
        ? {
            lastName: form.directorLastName.trim(),
            firstName: form.directorFirstName.trim(),
            middleName: form.directorMiddleName.trim(),
          }
        : null;
    const common = {
      name: form.name.trim(),
      rawName: form.rawName.trim() || undefined,
      establishment: form.establishment.trim(),
      bankCode: form.bankCode.trim() || undefined,
      bank: form.bank.trim() || undefined,
      bankAccount: form.bankAccount.trim() || undefined,
      address: form.address.trim() || undefined,
      director,
      registrationDate: form.registrationDate || null,
    };
    try {
      if (isNew) {
        await legalEntitiesApi.create({ taxId: form.taxId, ...common });
      } else {
        await legalEntitiesApi.update(entity!.id, common);
      }
      toast.success(t("saved"));
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER701") setError(t("errors.ER701"));
      else if (e instanceof ApiError && e.code === "ER101")
        setError(t("errors.validation"));
      else setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? t("create") : t("edit")}</DialogTitle>
          <DialogDescription>
            {isNew ? t("createHint") : t("editHint")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="le-taxid" className="text-sm font-medium text-muted-foreground">
              {t("taxId")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="le-taxid"
                value={form.taxId}
                disabled={!isNew}
                inputMode="numeric"
                maxLength={14}
                placeholder="310529901"
                onChange={(e) => set("taxId", e.target.value.replace(/\D/g, ""))}
                className="flex-1 tabular-nums"
              />
              {isNew && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={lookingUp || !taxIdValid}
                  onClick={lookup}
                  className="gap-2"
                >
                  {lookingUp ? (
                    <Spinner className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {t("lookup")}
                </Button>
              )}
            </div>
            {isNew && (
              <span className="text-xs text-muted-foreground">{t("taxIdHint")}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="le-name" className="text-sm font-medium text-muted-foreground">
              {t("name")}
            </Label>
            <Input
              id="le-name"
              value={form.name}
              maxLength={300}
              onChange={(e) => set("name", e.target.value)}
            />
            {form.rawName && (
              <span className="text-xs text-muted-foreground">
                {t("rawName")}: {form.rawName}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="le-establishment" className="text-sm font-medium text-muted-foreground">
              {t("establishment")}
            </Label>
            <Input
              id="le-establishment"
              value={form.establishment}
              maxLength={200}
              placeholder={t("establishmentPlaceholder")}
              onChange={(e) => set("establishment", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="le-mfo" className="text-sm font-medium text-muted-foreground">
                {t("bankCode")}
              </Label>
              <Input
                id="le-mfo"
                value={form.bankCode}
                inputMode="numeric"
                maxLength={5}
                onChange={(e) => set("bankCode", e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="le-account" className="text-sm font-medium text-muted-foreground">
                {t("bankAccount")}
              </Label>
              <Input
                id="le-account"
                value={form.bankAccount}
                inputMode="numeric"
                maxLength={20}
                onChange={(e) => set("bankAccount", e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="le-bank" className="text-sm font-medium text-muted-foreground">
              {t("bankName")}
            </Label>
            <Input
              id="le-bank"
              value={form.bank}
              maxLength={300}
              placeholder={t("bankNamePlaceholder")}
              onChange={(e) => set("bank", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="le-address" className="text-sm font-medium text-muted-foreground">
              {t("address")}
            </Label>
            <Input
              id="le-address"
              value={form.address}
              maxLength={300}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              {t("director")}
            </span>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                aria-label={t("directorLastName")}
                placeholder={t("directorLastName")}
                value={form.directorLastName}
                onChange={(e) => set("directorLastName", e.target.value)}
                className="min-w-0"
              />
              <Input
                aria-label={t("directorFirstName")}
                placeholder={t("directorFirstName")}
                value={form.directorFirstName}
                onChange={(e) => set("directorFirstName", e.target.value)}
                className="min-w-0"
              />
              <Input
                aria-label={t("directorMiddleName")}
                placeholder={t("directorMiddleName")}
                value={form.directorMiddleName}
                onChange={(e) => set("directorMiddleName", e.target.value)}
                className="min-w-0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="le-regdate" className="text-sm font-medium text-muted-foreground">
              {t("registrationDate")}
            </Label>
            <DatePicker
              id="le-regdate"
              value={form.registrationDate}
              onChange={(v) => set("registrationDate", v)}
              placeholder={t("pickDate")}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
