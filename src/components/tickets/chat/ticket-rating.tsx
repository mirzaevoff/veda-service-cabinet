"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Ticket } from "@/lib/api";
import { ticketsApi } from "@/lib/api-authed";
import { cn } from "@/lib/utils";

function Stars({
  value,
  hover,
  onPick,
  onHover,
}: {
  value: number;
  hover?: number;
  onPick?: (v: number) => void;
  onHover?: (v: number) => void;
}) {
  const active = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => onHover?.(0)}>
      {Array.from({ length: 5 }, (_, i) => {
        const star = i + 1;
        const filled = star <= active;
        const StarEl = (
          <Star
            className={cn(
              "size-6 transition-colors",
              filled ? "fill-warning text-warning" : "text-muted-foreground/40"
            )}
            strokeWidth={1.75}
          />
        );
        if (!onPick) return <span key={star}>{StarEl}</span>;
        return (
          <button
            key={star}
            type="button"
            aria-label={String(star)}
            onClick={() => onPick(star)}
            onMouseEnter={() => onHover?.(star)}
            className="transition-transform hover:scale-110"
          >
            {StarEl}
          </button>
        );
      })}
    </div>
  );
}

/** Блок оценки закрытого тикета: автор ставит/меняет, staff видит результат */
export function TicketRating({
  ticket,
  isAuthor,
  onUpdated,
}: {
  ticket: Ticket;
  isAuthor: boolean;
  onUpdated: (ticket: Ticket) => void;
}) {
  const t = useTranslations("Tickets.chat");
  const te = useTranslations("Tickets.errors");

  const [value, setValue] = useState(ticket.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState(ticket.review);
  const [busy, setBusy] = useState(false);

  if (!isAuthor) {
    if (!ticket.rating) return null;
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t("ratedLabel")}</span>
        <Stars value={ticket.rating} />
        {ticket.review && (
          <p className="max-w-md text-center text-sm text-muted-foreground">
            «{ticket.review}»
          </p>
        )}
      </div>
    );
  }

  const dirty =
    value > 0 && (value !== ticket.rating || review.trim() !== ticket.review);

  async function submit() {
    setBusy(true);
    try {
      onUpdated(
        await ticketsApi.rate(ticket.id, {
          rating: value,
          review: review.trim() || undefined,
        })
      );
      toast.success(t("rateSaved"));
    } catch {
      toast.error(te("generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <span className="text-sm font-medium">
        {ticket.rating ? t("yourRating") : t("ratePrompt")}
      </span>
      <Stars value={value} hover={hover} onPick={setValue} onHover={setHover} />
      {value > 0 && (
        <Textarea
          value={review}
          maxLength={1000}
          rows={2}
          placeholder={t("reviewPlaceholder")}
          onChange={(e) => setReview(e.target.value)}
          className="w-full"
        />
      )}
      {dirty && (
        <Button size="sm" onClick={submit} disabled={busy} className="gap-2">
          {busy ? <Spinner className="size-4" /> : t("rateSubmit")}
        </Button>
      )}
    </div>
  );
}
