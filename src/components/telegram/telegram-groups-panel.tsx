"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  Info,
  Link2,
  Power,
  RadioTower,
  Search,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  LegalEntityPicker,
  type PickedEntity,
} from "@/components/legal-entities/legal-entity-picker";
import { ApiError, type TelegramChat, type TelegramDiscoveredChat } from "@/lib/api";
import { SessionExpiredError, telegramApi } from "@/lib/api-authed";
import { useRouter } from "@/i18n/navigation";

/** Экран 1: Telegram-группы клиентов — обнаружение, привязка к ЮЛ, тест */
export function TelegramGroupsPanel() {
  const t = useTranslations("Telegram");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [chats, setChats] = useState<TelegramChat[] | null>(null);
  const [discovered, setDiscovered] = useState<TelegramDiscoveredChat[] | null>(
    null
  );
  const [discovering, setDiscovering] = useState(false);
  const [toRemove, setToRemove] = useState<TelegramChat | null>(null);

  const load = useCallback(() => {
    telegramApi
      .list()
      .then(setChats)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- методы стабильны
  }, []);

  useEffect(() => load(), [load]);

  const boundChatIds = new Set((chats ?? []).map((c) => c.chatId));

  function mapError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.code === "ER2600") return t("errors.notConfigured");
      if (e.code === "ER2601") return t("errors.webhook");
      if (e.code === "ER2602") return t("errors.bindingNotFound");
    }
    return t("errors.generic");
  }

  async function discover() {
    setDiscovering(true);
    try {
      const list = await telegramApi.discover();
      setDiscovered(list);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        router.replace("/login");
        return;
      }
      setDiscovered([]);
      toast.error(mapError(e));
    } finally {
      setDiscovering(false);
    }
  }

  async function removeChat() {
    if (!toRemove) return;
    try {
      await telegramApi.remove(toRemove.id);
      toast.success(t("removed"));
      setToRemove(null);
      load();
    } catch (e) {
      toast.error(mapError(e));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Инструкция «как получить chat_id» */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("howTitle")}</span>
          <ol className="flex list-inside list-decimal flex-col gap-0.5 text-muted-foreground">
            <li>{t("howStep1")}</li>
            <li>{t("howStep2")}</li>
            <li>{t("howStep3")}</li>
          </ol>
        </div>
      </div>

      {/* Обнаружение */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("discoverTitle")}</h3>
          <Button
            onClick={() => void discover()}
            disabled={discovering}
            className="gap-2"
          >
            {discovering ? (
              <Spinner className="size-4" />
            ) : (
              <RadioTower className="size-4" />
            )}
            {t("discover")}
          </Button>
        </div>

        {discovered !== null &&
          (discovered.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-border p-4 text-sm text-muted-foreground">
              <Search className="mt-0.5 size-4 shrink-0" />
              <span>{t("discoverEmpty")}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {discovered.map((c) => (
                <DiscoveredRow
                  key={c.chatId}
                  chat={c}
                  alreadyBound={boundChatIds.has(c.chatId)}
                  onBound={() => {
                    load();
                    setDiscovered((prev) =>
                      prev
                        ? prev.filter((x) => x.chatId !== c.chatId)
                        : prev
                    );
                  }}
                />
              ))}
            </div>
          ))}

        {/* Ручной ввод chat_id — запасной путь */}
        <ManualBind onBound={load} />
      </section>

      {/* Привязанные группы */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("boundTitle")}</h3>
        {chats === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {t("boundEmpty")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {chats.map((c) => (
              <BoundRow
                key={c.id}
                chat={c}
                onChanged={load}
                onRemove={() => setToRemove(c)}
                mapError={mapError}
              />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeConfirmText")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void removeChat()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Строка обнаруженного чата: название + chat_id + выбор ЮЛ + «Привязать» */
function DiscoveredRow({
  chat,
  alreadyBound,
  onBound,
}: {
  chat: TelegramDiscoveredChat;
  alreadyBound: boolean;
  onBound: () => void;
}) {
  const t = useTranslations("Telegram");
  const [entity, setEntity] = useState<PickedEntity | null>(null);
  const [busy, setBusy] = useState(false);

  async function bind() {
    if (!entity) return;
    setBusy(true);
    try {
      await telegramApi.bind({
        chatId: chat.chatId,
        title: chat.title,
        legalEntityId: entity.id,
      });
      toast.success(t("bound", { name: entity.name }));
      onBound();
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.code === "ER2601"
          ? t("errors.webhook")
          : t("errors.generic")
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {chat.title || t("untitled")}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {chat.chatId} · {chat.type}
        </span>
      </div>
      {alreadyBound ? (
        <Badge variant="secondary" className="gap-1 bg-success-light text-success">
          <Link2 className="size-3" />
          {t("alreadyBound")}
        </Badge>
      ) : (
        <div className="flex items-center gap-2">
          <LegalEntityPicker
            value={entity}
            onChange={setEntity}
            placeholder={t("pickEntity")}
            className="w-48"
          />
          <Button
            size="sm"
            disabled={!entity || busy}
            onClick={() => void bind()}
            className="gap-1.5"
          >
            {busy ? <Spinner className="size-4" /> : <Link2 className="size-4" />}
            {t("bind")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Ручной ввод chat_id — запасной путь, если обнаружение не сработало */
function ManualBind({ onBound }: { onBound: () => void }) {
  const t = useTranslations("Telegram");
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState("");
  const [entity, setEntity] = useState<PickedEntity | null>(null);
  const [busy, setBusy] = useState(false);

  async function bind() {
    if (!entity || !chatId.trim()) return;
    setBusy(true);
    try {
      await telegramApi.bind({
        chatId: chatId.trim(),
        legalEntityId: entity.id,
      });
      toast.success(t("bound", { name: entity.name }));
      setChatId("");
      setEntity(null);
      setOpen(false);
      onBound();
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.code === "ER2601"
          ? t("errors.webhook")
          : t("errors.generic")
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        {t("manualToggle")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <span className="text-sm font-medium">{t("manualTitle")}</span>
      <p className="text-xs text-muted-foreground">{t("manualHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="-1001234567890"
          className="w-48 font-mono"
        />
        <LegalEntityPicker
          value={entity}
          onChange={setEntity}
          placeholder={t("pickEntity")}
          className="w-48"
        />
        <Button
          size="sm"
          disabled={!entity || !chatId.trim() || busy}
          onClick={() => void bind()}
          className="gap-1.5"
        >
          {busy ? <Spinner className="size-4" /> : <Link2 className="size-4" />}
          {t("bind")}
        </Button>
      </div>
    </div>
  );
}

/** Строка привязанной группы: ЮЛ, статус, тест, вкл/выкл, удалить */
function BoundRow({
  chat,
  onChanged,
  onRemove,
  mapError,
}: {
  chat: TelegramChat;
  onChanged: () => void;
  onRemove: () => void;
  mapError: (e: unknown) => string;
}) {
  const t = useTranslations("Telegram");
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function test() {
    setTesting(true);
    try {
      await telegramApi.test(chat.id);
      toast.success(t("testSent"));
    } catch (e) {
      toast.error(mapError(e));
    } finally {
      setTesting(false);
    }
  }

  async function toggleActive() {
    setToggling(true);
    try {
      await telegramApi.update(chat.id, { active: !chat.active });
      onChanged();
    } catch (e) {
      toast.error(mapError(e));
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {chat.title || t("untitled")}
          </span>
          {!chat.active && (
            <Badge variant="secondary" className="text-muted-foreground">
              {t("inactive")}
            </Badge>
          )}
        </div>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {chat.chatId}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs">
          {chat.legalEntity ? (
            <>
              <Building2 className="size-3 text-muted-foreground" />
              <span className="truncate text-muted-foreground">
                {chat.legalEntity.name}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-warning">
              <TriangleAlert className="size-3" />
              {t("noEntity")}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={testing || !chat.active}
          onClick={() => void test()}
          className="gap-1.5"
        >
          {testing ? <Spinner className="size-4" /> : <Send className="size-4" />}
          {t("test")}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={toggling}
          onClick={() => void toggleActive()}
          aria-label={chat.active ? t("deactivate") : t("activate")}
          title={chat.active ? t("deactivate") : t("activate")}
        >
          {toggling ? (
            <Spinner className="size-4" />
          ) : (
            <Power
              className={chat.active ? "size-4 text-success" : "size-4 text-muted-foreground"}
            />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={t("remove")}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
