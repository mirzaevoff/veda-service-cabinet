"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  FileAudio,
  FileText,
  FileVideo,
  ImageIcon,
  Paperclip,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, type FileAttachment, type FileKind } from "@/lib/api";
import {
  MAX_ATTACHMENTS,
  UPLOAD_ACCEPT,
  formatBytes,
  uploadFile,
  uploadLimitFor,
} from "@/lib/upload";
import { cn } from "@/lib/utils";

export interface PendingAttachment {
  /** Локальный ключ (не серверный id) */
  key: string;
  file: File;
  /** Превью для image из локального File */
  previewUrl: string | null;
  progress: number;
  uploaded: FileAttachment | null;
  error: string | null;
  abort: AbortController;
}

let keyCounter = 0;

function kindOf(file: File): FileKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

const KIND_ICON: Record<FileKind, typeof FileText> = {
  image: ImageIcon,
  video: FileVideo,
  audio: FileAudio,
  file: FileText,
};

export function useAttachments() {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const t = useTranslations("Tickets.attachments");

  const update = useCallback(
    (key: string, patch: Partial<PendingAttachment>) => {
      setItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const startUpload = useCallback(
    (item: PendingAttachment) => {
      uploadFile(item.file, {
        signal: item.abort.signal,
        onProgress: (fraction) => update(item.key, { progress: fraction }),
      })
        .then((uploaded) =>
          update(item.key, { uploaded, progress: 1, error: null })
        )
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          let message = t("uploadError");
          if (e instanceof ApiError && e.code === "ER501") {
            message = t("badType");
          } else if (e instanceof ApiError && e.code === "ER502") {
            const limit = uploadLimitFor(item.file);
            message = t("tooLarge", {
              size: limit ? formatBytes(limit.maxBytes) : "—",
            });
          }
          update(item.key, { error: message });
        });
    },
    [update, t]
  );

  const add = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      setItems((prev) => {
        const room = MAX_ATTACHMENTS - prev.length;
        const accepted = list.slice(0, Math.max(0, room)).map((file) => {
          const item: PendingAttachment = {
            key: `att-${++keyCounter}`,
            file,
            previewUrl: file.type.startsWith("image/")
              ? URL.createObjectURL(file)
              : null,
            progress: 0,
            uploaded: null,
            error: null,
            abort: new AbortController(),
          };
          queueMicrotask(() => startUpload(item));
          return item;
        });
        return [...prev, ...accepted];
      });
    },
    [startUpload]
  );

  const retry = useCallback(
    (key: string) => {
      setItems((prev) => {
        const item = prev.find((i) => i.key === key);
        if (item) {
          const fresh = { ...item, error: null, progress: 0, abort: new AbortController() };
          queueMicrotask(() => startUpload(fresh));
          return prev.map((i) => (i.key === key ? fresh : i));
        }
        return prev;
      });
    },
    [startUpload]
  );

  const remove = useCallback((key: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.key === key);
      if (item) {
        item.abort.abort();
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.key !== key);
    });
  }, []);

  const clear = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, []);

  const uploading = items.some((i) => !i.uploaded && !i.error);
  const attachmentIds = items
    .filter((i) => i.uploaded)
    .map((i) => i.uploaded!.id);

  return { items, add, remove, retry, clear, uploading, attachmentIds };
}

export function AttachmentPicker({
  onPick,
  disabled,
  variant = "outline",
}: {
  onPick: (files: FileList) => void;
  disabled?: boolean;
  variant?: "outline" | "ghost";
}) {
  const t = useTranslations("Tickets.attachments");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant={variant}
        size={variant === "ghost" ? "icon" : "sm"}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label={t("add")}
        className={cn(variant === "outline" && "gap-2")}
      >
        <Paperclip className="size-4" />
        {variant === "outline" && t("add")}
      </Button>
    </>
  );
}

export function AttachmentList({
  items,
  onRemove,
  onRetry,
}: {
  items: PendingAttachment[];
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const Icon = KIND_ICON[kindOf(item.file)];
        return (
          <div
            key={item.key}
            className={cn(
              "relative flex w-40 flex-col gap-1.5 rounded-md border border-border p-2 duration-300 animate-in fade-in zoom-in-95",
              item.error && "border-destructive bg-accent-light/50"
            )}
          >
            <div className="flex items-center gap-2">
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-9 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded bg-secondary">
                  <Icon className="size-4.5 text-muted-foreground" />
                </div>
              )}
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium">
                  {item.file.name}
                </span>
                <span className="text-[0.7rem] text-muted-foreground">
                  {formatBytes(item.file.size)}
                </span>
              </div>
            </div>

            {!item.uploaded && !item.error && (
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${Math.round(item.progress * 100)}%` }}
                />
              </div>
            )}
            {item.error && (
              <p className="text-[0.7rem] leading-tight text-destructive">
                {item.error}
              </p>
            )}

            <div className="absolute -right-1.5 -top-1.5 flex gap-1">
              {item.error && (
                <button
                  type="button"
                  onClick={() => onRetry(item.key)}
                  className="flex size-5 items-center justify-center rounded-full bg-secondary text-muted-foreground shadow-sm transition-transform hover:scale-110"
                >
                  <RotateCcw className="size-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.key)}
                className="flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform hover:scale-110"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
