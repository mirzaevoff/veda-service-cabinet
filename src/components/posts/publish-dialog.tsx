"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Globe, RotateCw, Send, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, type Post, type PostPublication, type TelegramChat } from "@/lib/api";
import { postsApi, telegramApi } from "@/lib/api-authed";
import { cn } from "@/lib/utils";

/** Экран 3: выборочная публикация — сайт и/или Telegram-группы */
export function PublishDialog({
  open,
  post,
  onClose,
  onPublished,
}: {
  open: boolean;
  post: Post;
  onClose: () => void;
  onPublished: (updated: Post) => void;
}) {
  const t = useTranslations("Posts.publish");
  const tc = useTranslations("Common");

  const [chats, setChats] = useState<TelegramChat[] | null | "forbidden">(null);
  const [site, setSite] = useState(post.status !== "published");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PostPublication[] | null>(null);

  // Сброс и загрузка групп — только при ОТКРЫТИИ диалога. Нельзя завязывать на
  // post.status: он меняется после публикации (onPublished), и это стёрло бы
  // показанный результат отправки.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- инициализация при открытии
    setSite(post.status !== "published");
    setSelected(new Set());
    setResults(null);
    setChats(null);
    let cancelled = false;
    telegramApi
      .list()
      .then((list) => !cancelled && setChats(list.filter((c) => c.active)))
      .catch((e) => {
        if (cancelled) return;
        setChats(e instanceof ApiError && e.status === 403 ? "forbidden" : []);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно только при open
  }, [open]);

  const chatList = Array.isArray(chats) ? chats : [];
  const selectedCount = selected.size;
  const nothing = !site && selectedCount === 0;

  function toggleChat(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function publish(onlyChatIds?: string[]) {
    setPublishing(true);
    try {
      const body = onlyChatIds
        ? { telegramChatIds: onlyChatIds }
        : { site, telegramChatIds: [...selected] };
      const before = new Set(
        post.publications.map((p) => `${p.channel}:${p.chatId}:${p.at}`)
      );
      const updated = await postsApi.publish(post.id, body);
      onPublished(updated);
      const fresh = updated.publications.filter(
        (p) => !before.has(`${p.channel}:${p.chatId}:${p.at}`)
      );
      setResults(fresh);
      const failed = fresh.filter((p) => !p.ok).length;
      if (failed === 0) toast.success(t("done"));
      else toast.error(t("partialFail", { count: failed }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER2701") toast.error(t("slugTaken"));
      else toast.error(t("error"));
    } finally {
      setPublishing(false);
    }
  }

  // Карта chatId → id привязки (для повтора неудачных отправок)
  const chatIdToBinding = useMemo(() => {
    const m: Record<string, string> = {};
    if (Array.isArray(chats)) for (const c of chats) m[c.chatId] = c.id;
    return m;
  }, [chats]);

  const failed = results?.filter((r) => r.channel === "telegram" && !r.ok) ?? [];
  const retryIds = failed
    .map((r) => chatIdToBinding[r.chatId])
    .filter((x): x is string => !!x);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        {results ? (
          // --- Результат ---
          <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
            {results.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("noChanges")}</p>
            ) : (
              results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg border border-border p-3 text-sm"
                >
                  {r.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-destructive" />
                  )}
                  {r.channel === "site" ? (
                    <Globe className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Send className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {r.channel === "site" ? t("channelSite") : r.chatTitle || r.chatId}
                  </span>
                  <span className={cn("shrink-0 text-xs", r.ok ? "text-success" : "text-destructive")}>
                    {r.ok ? t("ok") : t("failed")}
                  </span>
                </div>
              ))
            )}
            {retryIds.length > 0 && (
              <Button
                variant="outline"
                disabled={publishing}
                onClick={() => void publish(retryIds)}
                className="gap-2 self-start"
              >
                {publishing ? <Spinner className="size-4" /> : <RotateCw className="size-4" />}
                {t("retryFailed", { count: retryIds.length })}
              </Button>
            )}
          </div>
        ) : (
          // --- Выбор каналов ---
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setSite((v) => !v)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                site ? "border-primary/40 bg-accent-light" : "border-border hover:border-primary/30"
              )}
            >
              <Checkbox checked={site} className="pointer-events-none" />
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{t("toSite")}</span>
            </button>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("toGroups")}
              </span>
              {chats === null ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : chats === "forbidden" ? (
                <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                  {t("noTelegramAccess")}
                </p>
              ) : chatList.length === 0 ? (
                <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                  {t("noGroups")}
                </p>
              ) : (
                <div className="-mr-1 flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
                  {chatList.map((c) => {
                    const on = selected.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleChat(c.id)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          on ? "border-primary/40 bg-accent-light" : "border-border hover:border-primary/30"
                        )}
                      >
                        <Checkbox checked={on} className="pointer-events-none" />
                        <Send className="size-4 shrink-0 text-muted-foreground" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{c.title || c.chatId}</span>
                          {c.legalEntity && (
                            <span className="truncate text-xs text-muted-foreground">
                              {c.legalEntity.name}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedCount > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-light/40 p-3">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <span className="text-sm text-warning">{t("telegramIrreversible")}</span>
              </div>
            )}

            {post.status === "published" && (
              <p className="text-xs text-muted-foreground">{t("republishHint")}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {results ? (
            <Button onClick={onClose}>{tc("done")}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={publishing}>
                {tc("cancel")}
              </Button>
              <Button disabled={nothing || publishing} onClick={() => void publish()} className="gap-2">
                {publishing ? <Spinner className="size-4" /> : <Send className="size-4" />}
                {selectedCount > 0 ? t("publishAndSend", { count: selectedCount }) : t("publishBtn")}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
