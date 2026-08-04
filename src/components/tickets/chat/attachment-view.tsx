"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileAudio, FileText, FileVideo, ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { FileAttachment } from "@/lib/api";
import { refreshSession } from "@/lib/auth";
import { formatBytes } from "@/lib/upload";
import { cn } from "@/lib/utils";

function fileUrl(file: FileAttachment, bust?: number) {
  return `/api/files/${file.id}${bust ? `?r=${bust}` : ""}`;
}

/** HEIC браузеры (кроме Safari) не показывают — отдаём карточкой */
function isRenderableImage(file: FileAttachment) {
  return file.kind === "image" && !/hei[cf]/.test(file.mime);
}

function FileCard({ file }: { file: FileAttachment }) {
  const t = useTranslations("Tickets.attachments");
  const Icon =
    file.kind === "video" ? FileVideo : file.kind === "audio" ? FileAudio : file.kind === "image" ? ImageIcon : FileText;

  return (
    <a
      href={fileUrl(file)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-60 items-center gap-3 rounded-md border border-border bg-card p-2.5 transition-colors hover:border-primary/40"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded bg-accent-light">
        <Icon className="size-4.5 text-primary" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium">{file.originalName}</span>
        <span className="text-[0.7rem] text-muted-foreground">
          {formatBytes(file.size)} · {t("download")}
        </span>
      </div>
      <Download className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

/** Медиа с восстановлением после протухшего access-токена */
function useMediaRetry() {
  const [bust, setBust] = useState(0);
  return {
    bust,
    onError: () => {
      if (bust > 2) return;
      refreshSession()
        .then(() => setBust((b) => b + 1))
        .catch(() => {});
    },
  };
}

function ImageAttachment({ file }: { file: FileAttachment }) {
  const [open, setOpen] = useState(false);
  const { bust, onError } = useMediaRetry();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl(file, bust)}
          alt={file.originalName}
          loading="lazy"
          onError={onError}
          className="max-h-64 max-w-70 rounded-md object-cover transition-opacity hover:opacity-90"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="max-w-[92vw] border-0 bg-transparent p-0 shadow-none sm:max-w-4xl"
        >
          <DialogTitle className="sr-only">{file.originalName}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(file, bust)}
            alt={file.originalName}
            className="max-h-[85vh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function VideoAttachment({ file }: { file: FileAttachment }) {
  const { bust, onError } = useMediaRetry();
  return (
    <video
      controls
      preload="metadata"
      onError={onError}
      className="max-h-72 max-w-80 rounded-md bg-black/5"
      src={fileUrl(file, bust)}
    />
  );
}

function AudioAttachment({ file }: { file: FileAttachment }) {
  const { bust, onError } = useMediaRetry();
  return (
    <audio
      controls
      preload="metadata"
      onError={onError}
      className="w-64"
      src={fileUrl(file, bust)}
    />
  );
}

export function AttachmentView({
  attachments,
  className,
}: {
  attachments: FileAttachment[];
  className?: string;
}) {
  if (!attachments.length) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {attachments.map((file) => {
        if (isRenderableImage(file)) {
          return <ImageAttachment key={file.id} file={file} />;
        }
        if (file.kind === "video") {
          return <VideoAttachment key={file.id} file={file} />;
        }
        if (file.kind === "audio") {
          return <AudioAttachment key={file.id} file={file} />;
        }
        return <FileCard key={file.id} file={file} />;
      })}
    </div>
  );
}
