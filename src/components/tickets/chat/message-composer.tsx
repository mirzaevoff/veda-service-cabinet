"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AttachmentList,
  AttachmentPicker,
  useAttachments,
} from "../attachment-uploader";
import { sendTyping } from "@/lib/ticket-socket";

export function MessageComposer({
  ticketId,
  disabled,
  onSend,
}: {
  ticketId: string;
  disabled?: boolean;
  onSend: (body: { text?: string; attachmentIds?: string[] }) => Promise<boolean>;
}) {
  const t = useTranslations("Tickets.chat");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const attachments = useAttachments();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend =
    !disabled &&
    !sending &&
    !attachments.uploading &&
    (text.trim().length > 0 || attachments.attachmentIds.length > 0);

  async function submit() {
    if (!canSend) return;
    setSending(true);
    const ok = await onSend({
      text: text.trim() || undefined,
      attachmentIds: attachments.attachmentIds.length
        ? attachments.attachmentIds
        : undefined,
    });
    if (ok) {
      setText("");
      attachments.clear();
      textareaRef.current?.focus();
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-background p-3 sm:p-4">
      <AttachmentList
        items={attachments.items}
        onRemove={attachments.remove}
        onRetry={attachments.retry}
      />
      <div className="flex items-end gap-2">
        <AttachmentPicker
          variant="ghost"
          onPick={attachments.add}
          disabled={disabled || attachments.items.length >= 10}
        />
        <Textarea
          ref={textareaRef}
          value={text}
          disabled={disabled}
          placeholder={t("placeholder")}
          rows={1}
          maxLength={2000}
          onChange={(e) => {
            setText(e.target.value);
            sendTyping(ticketId);
            // Autosize
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border-[1.5px] py-2.5 !text-[15px]"
        />
        <Button
          size="icon"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label={t("send")}
          className="shrink-0"
        >
          <SendHorizontal className="size-4.5" />
        </Button>
      </div>
    </div>
  );
}
