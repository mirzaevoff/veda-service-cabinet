"use client";

import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Globe, Send, XCircle } from "lucide-react";
import type { PostPublication } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Журнал публикаций поста: куда, когда, дошло ли */
export function PostPublications({
  publications,
}: {
  publications: PostPublication[];
}) {
  const t = useTranslations("Posts");
  const locale = useLocale();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  // Свежие сверху
  const rows = [...publications].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("journal")}
      </h3>
      <div className="flex flex-col divide-y divide-border">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2 text-sm">
            {r.channel === "site" ? (
              <Globe className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Send className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">
                {r.channel === "site" ? t("publish.channelSite") : r.chatTitle || r.chatId}
              </span>
              {/* by: null/нет — системная или старая запись, автора не показываем */}
              {r.by?.name && (
                <span className="truncate text-xs text-muted-foreground">{r.by.name}</span>
              )}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {fmt(r.at)}
            </span>
            {r.ok ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-xs text-destructive">
                <XCircle className="size-4" />
                {t("publish.failed")}
              </span>
            )}
          </div>
        ))}
      </div>
      <span className={cn("text-xs text-muted-foreground")}>{t("journalHint")}</span>
    </section>
  );
}
