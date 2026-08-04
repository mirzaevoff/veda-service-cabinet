"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  AttachmentList,
  AttachmentPicker,
  useAttachments,
} from "./attachment-uploader";
import type { LegalEntity, TicketCategory } from "@/lib/api";
import { ApiError } from "@/lib/api";
import {
  SessionExpiredError,
  legalEntitiesApi,
  ticketsApi,
} from "@/lib/api-authed";
import { useRouter } from "@/i18n/navigation";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/utils";

type Step = "category" | "subcategory" | "details";

const byOrder = (a: TicketCategory, b: TicketCategory) =>
  a.order - b.order || a.name.ru.localeCompare(b.name.ru);

export function CreateTicketFlow() {
  const t = useTranslations("Tickets.create");
  const locale = useLocale();
  const te = useTranslations("Tickets.errors");
  const router = useRouter();

  const [categories, setCategories] = useState<TicketCategory[] | null>(null);
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [subcategory, setSubcategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [entityId, setEntityId] = useState("");
  const attachments = useAttachments();

  useEffect(() => {
    ticketsApi
      .categories()
      .then((all) => setCategories(all.filter((c) => c.isActive).sort(byOrder)))
      .catch(() => setCategories([]));
    legalEntitiesApi
      .my()
      .then(setEntities)
      .catch(() => {});
  }, []);

  const activeChildren = useMemo(
    () => (category?.children ?? []).filter((c) => c.isActive).sort(byOrder),
    [category]
  );

  function fail(message: string) {
    setError(message);
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  }

  function pickCategory(c: TicketCategory) {
    setCategory(c);
    setSubcategory(null);
    const children = (c.children ?? []).filter((x) => x.isActive);
    setStep(children.length > 0 ? "subcategory" : "details");
  }

  async function submit() {
    if (!category) return;
    if (!subject.trim()) {
      fail(t("subjectRequired"));
      return;
    }
    if (!text.trim() && attachments.attachmentIds.length === 0) {
      fail(te("ER405"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await ticketsApi.create({
        subject: subject.trim(),
        categoryId: category.id,
        subcategoryId: subcategory?.id,
        legalEntityId: entityId || undefined,
        text: text.trim() || undefined,
        attachmentIds: attachments.attachmentIds.length
          ? attachments.attachmentIds
          : undefined,
      });
      router.replace(`/tickets/${ticket.id}`);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        router.replace("/login");
      } else if (e instanceof ApiError && (e.code === "ER402" || e.code === "ER403")) {
        toast.error(te("ER402"));
        setStep("category");
        setCategory(null);
        setSubcategory(null);
      } else if (e instanceof ApiError && e.code === "ER405") {
        fail(te("ER405"));
      } else {
        fail(te(e instanceof ApiError && e.code === "NETWORK" ? "network" : "generic"));
      }
      setSubmitting(false);
    }
  }

  if (!categories) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  const categoryCards = (
    items: TicketCategory[],
    onPick: (c: TicketCategory) => void
  ) => (
    <div className="flex flex-col gap-2">
      {items.map((c, i) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c)}
          className="text-left duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards]"
          style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
        >
          <Card className="flex-row items-center gap-3 rounded-lg p-4 transition-colors hover:border-primary/40 hover:bg-accent-light/30">
            <span className="flex-1 font-medium">{pickLocalized(c.name, locale)}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Card>
        </button>
      ))}
      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("noCategories")}
        </p>
      )}
    </div>
  );

  return (
    <div
      key={step}
      className={cn(
        "flex flex-col gap-5 duration-450 animate-in fade-in slide-in-from-bottom-4",
        shaking && "animate-shake"
      )}
    >
      {step === "category" && (
        <>
          <p className="text-sm text-muted-foreground">{t("pickCategory")}</p>
          {categoryCards(categories, pickCategory)}
        </>
      )}

      {step === "subcategory" && category && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("pickSubcategory", { category: pickLocalized(category.name, locale) })}
          </p>
          {categoryCards(activeChildren, (c) => {
            setSubcategory(c);
            setStep("details");
          })}
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => {
              setStep("details");
              setSubcategory(null);
            }}
          >
            {t("skipSubcategory")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => setStep("category")}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("back")}
          </Button>
        </>
      )}

      {step === "details" && category && (
        <>
          <p className="text-sm text-muted-foreground">
            {pickLocalized(category.name, locale)}
            {subcategory && ` · ${pickLocalized(subcategory.name, locale)}`}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject" className="text-sm font-medium text-muted-foreground">
              {t("subjectLabel")}
            </Label>
            <Input
              id="subject"
              autoFocus
              maxLength={50}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setError(null);
              }}
              placeholder={t("subjectPlaceholder")}
              className="h-[54px] rounded-md border-[1.5px] !text-base"
            />
          </div>

          {entities.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("entityLabel")}
              </Label>
              <Select
                value={entityId || "none"}
                items={Object.fromEntries([
                  ["none", t("entityNone")],
                  ...entities.map((e) => [e.id, e.name]),
                ])}
                onValueChange={(v) => setEntityId(v === "none" ? "" : (v as string))}
              >
                <SelectTrigger className="h-[54px] w-full rounded-md border-[1.5px] !text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("entityNone")}</SelectItem>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="text" className="text-sm font-medium text-muted-foreground">
              {t("textLabel")}
            </Label>
            <Textarea
              id="text"
              rows={5}
              maxLength={2000}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              placeholder={t("textPlaceholder")}
              className="rounded-md border-[1.5px] !text-base"
            />
            <span className="self-end text-xs text-muted-foreground tabular-nums">
              {text.length}/2000
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <AttachmentList
              items={attachments.items}
              onRemove={attachments.remove}
              onRetry={attachments.retry}
            />
            <div>
              <AttachmentPicker
                onPick={attachments.add}
                disabled={attachments.items.length >= 10}
              />
            </div>
          </div>

          {error && <p className="text-xs leading-4 text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <Button
              onClick={submit}
              disabled={submitting || attachments.uploading}
              className="h-[54px] flex-1 text-base font-semibold sm:flex-none sm:px-10"
            >
              {submitting ? <Spinner /> : t("submit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() =>
                setStep(activeChildren.length > 0 ? "subcategory" : "category")
              }
            >
              <ArrowLeft data-icon="inline-start" />
              {t("back")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
