"use client";

import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import type { AppNotification } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** [текст](url) + переносы строк — без сырого HTML */
export function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = linkRe.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      <a
        key={key++}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-accent-bright"
      >
        {match[1]}
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Файлы отдаём через прокси /api, внешние ссылки — как есть */
export function imageSrc(url: string) {
  return url.startsWith("/files/") ? `/api${url}` : url;
}

/** Одно уведомление — общий рендер для колокольчика и страницы */
export function NotificationItem({
  notification: n,
  onSeen,
  className,
  style,
}: {
  notification: AppNotification;
  /** Отметить прочитанным (по наведению/появлению) */
  onSeen?: (n: AppNotification) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const locale = useLocale();
  return (
    <div
      style={style}
      onMouseEnter={() => onSeen?.(n)}
      className={cn(
        "flex flex-col gap-2 transition-colors",
        !n.readAt && "bg-accent-light/40",
        className
      )}
    >
      {n.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc(n.imageUrl)}
          alt=""
          loading="lazy"
          className="max-h-40 w-full rounded-md object-contain"
        />
      )}
      {n.text && (
        <p className="whitespace-pre-wrap text-sm leading-5">
          {renderMarkdown(n.text)}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(n.createdAt, locale)}
        </span>
        {n.button && (
          <a href={n.button.url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="xs">
              {n.button.text}
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
