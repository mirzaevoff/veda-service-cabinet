"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { accessRequestsApi } from "@/lib/api-authed";

/** Форма «Запросите доступ»: ИНН/ПИНФЛ + необязательный комментарий */
export function AccessRequestForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("LegalEntities.access");

  const [taxId, setTaxId] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taxIdValid = /^(\d{9}|\d{14})$/.test(taxId);

  async function submit() {
    if (!taxIdValid) {
      setError(t("taxIdFormat"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await accessRequestsApi.create({
        taxId,
        comment: comment.trim() || undefined,
      });
      setTaxId("");
      setComment("");
      toast.success(
        created.entityName
          ? t("requestedNamed", { name: created.entityName })
          : t("requested", { taxId: created.taxId })
      );
      onCreated();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER801") setError(t("errors.ER801"));
      else if (e instanceof ApiError && e.code === "ER805")
        setError(t("errors.ER805"));
      else if (e instanceof ApiError && e.code === "ER802")
        setError(t("errors.ER802"));
      else if (e instanceof ApiError && e.code === "ER101")
        setError(t("taxIdFormat"));
      else setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ar-taxid" className="text-sm font-medium text-muted-foreground">
          {t("taxIdLabel")}
        </Label>
        <Input
          id="ar-taxid"
          value={taxId}
          inputMode="numeric"
          maxLength={14}
          placeholder="310529901"
          onChange={(e) => {
            setTaxId(e.target.value.replace(/\D/g, ""));
            setError(null);
          }}
          className="tabular-nums"
        />
        <span className="text-xs text-muted-foreground">{t("taxIdHint")}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ar-comment" className="text-sm font-medium text-muted-foreground">
          {t("commentLabel")}
        </Label>
        <Textarea
          id="ar-comment"
          value={comment}
          maxLength={500}
          rows={2}
          placeholder={t("commentPlaceholder")}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={busy || !taxIdValid}
        className="gap-2 self-start"
      >
        {busy ? <Spinner className="size-4" /> : <Send className="size-4" />}
        {t("request")}
      </Button>
    </form>
  );
}
