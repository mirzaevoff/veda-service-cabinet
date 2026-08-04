"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AttachmentView } from "./attachment-view";
import type { TicketMessage } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ChatMessage extends TicketMessage {
  pending?: boolean;
  failed?: boolean;
}

export function MessageBubble({
  message,
  own,
  showAuthor,
  authorLabel,
  onRetry,
}: {
  message: ChatMessage;
  own: boolean;
  /** Имя над пузырём (первое сообщение в группе от чужого автора) */
  showAuthor: boolean;
  authorLabel: string;
  onRetry?: (message: ChatMessage) => void;
}) {
  const t = useTranslations("Tickets.chat");
  const locale = useLocale();

  return (
    <div
      className={cn(
        "flex flex-col gap-1 duration-300 animate-in fade-in slide-in-from-bottom-2",
        own ? "items-end" : "items-start"
      )}
    >
      {showAuthor && !own && (
        <span className="px-1 text-xs font-medium text-muted-foreground">
          {authorLabel}
        </span>
      )}
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2 rounded-lg px-3.5 py-2.5 sm:max-w-[70%]",
          own ? "rounded-br-sm bg-accent-light" : "rounded-bl-sm bg-secondary",
          message.failed && "border border-destructive"
        )}
      >
        {message.attachments.length > 0 && (
          <AttachmentView attachments={message.attachments} />
        )}
        {message.text && (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-6">
            {message.text}
          </p>
        )}
        <span
          className={cn(
            "flex items-center gap-1 self-end text-[0.7rem] leading-none",
            own ? "text-primary/60" : "text-muted-foreground"
          )}
        >
          {message.pending && <Spinner className="size-3" />}
          {message.failed && <AlertCircle className="size-3 text-destructive" />}
          {formatTime(message.createdAt, locale)}
        </span>
      </div>
      {message.failed && onRetry && (
        <button
          type="button"
          onClick={() => onRetry(message)}
          className="flex items-center gap-1 px-1 text-xs text-destructive hover:underline"
        >
          <RotateCcw className="size-3" />
          {t("retry")}
        </button>
      )}
    </div>
  );
}
