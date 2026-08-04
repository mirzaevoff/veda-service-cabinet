"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Megaphone, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shell/page-header";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { UserProfile } from "@/lib/api";
import { adminApi, notificationsApi } from "@/lib/api-authed";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { uploadFile } from "@/lib/upload";
import { useRef } from "react";

export default function AdminNotificationsPage() {
  const t = useTranslations("AdminNotifications");
  const { can } = useCurrentUser();

  const [broadcast, setBroadcast] = useState(true);
  const [selected, setSelected] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [found, setFound] = useState<UserProfile[]>([]);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [pushTitle, setPushTitle] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const canSearchUsers = can("users.list");

  useEffect(() => {
    if (broadcast || !debouncedSearch.trim() || !canSearchUsers) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс подсказок при выключении поиска
      setFound([]);
      return;
    }
    adminApi.users
      .list({ search: debouncedSearch.trim(), limit: 5 })
      .then((page) => setFound(page.items))
      .catch(() => {});
  }, [debouncedSearch, broadcast, canSearchUsers]);

  if (!can("notifications.send")) return <NoAccess />;

  const valid =
    (text.trim() || imageUrl.trim()) &&
    (broadcast || selected.length > 0) &&
    (!buttonText.trim() === !buttonUrl.trim());

  async function send() {
    setSending(true);
    try {
      await notificationsApi.send({
        broadcast: broadcast || undefined,
        userIds: broadcast ? undefined : selected.map((u) => u.id),
        text: text.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        button:
          buttonText.trim() && buttonUrl.trim()
            ? { text: buttonText.trim(), url: buttonUrl.trim() }
            : undefined,
        pushTitle: pushTitle.trim() || undefined,
      });
      toast.success(t("sent"));
      setText("");
      setImageUrl("");
      setButtonText("");
      setButtonUrl("");
      setPushTitle("");
      setSelected([]);
    } catch {
      toast.error(t("sendError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-col gap-5 duration-450 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("broadcast")}</span>
            <span className="text-xs text-muted-foreground">
              {t("broadcastHint")}
            </span>
          </div>
          <Switch checked={broadcast} onCheckedChange={setBroadcast} />
        </div>

        {!broadcast && (
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("recipients")}
            </Label>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((u) => (
                  <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
                    {u.name}
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((prev) => prev.filter((x) => x.id !== u.id))
                      }
                      className="flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {canSearchUsers ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchUsers")}
                  className="pl-9"
                />
                {found.length > 0 && (
                  <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                    {found
                      .filter((u) => !selected.some((s) => s.id === u.id))
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelected((prev) => [...prev, u]);
                            setSearch("");
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                        >
                          <span>{u.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {u.phone}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("needUsersList")}</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="n-text" className="text-sm font-medium text-muted-foreground">
            {t("text")}
          </Label>
          <Textarea
            id="n-text"
            rows={4}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("textPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="n-img" className="text-sm font-medium text-muted-foreground">
            {t("imageUrl")}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="n-img"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className="flex-1"
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setUploadingImage(true);
                try {
                  // public=true — файл раздаётся без авторизации, url абсолютный
                  const uploaded = await uploadFile(file, { public: true });
                  setImageUrl(uploaded.url);
                } catch {
                  toast.error(t("imageUploadError"));
                } finally {
                  setUploadingImage(false);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingImage}
              onClick={() => imageInputRef.current?.click()}
              className="gap-2"
            >
              {uploadingImage ? (
                <Spinner className="size-4" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              {t("uploadImage")}
            </Button>
          </div>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="mt-1 max-h-40 w-fit rounded-md object-cover"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="n-btn-text" className="text-sm font-medium text-muted-foreground">
              {t("buttonText")}
            </Label>
            <Input
              id="n-btn-text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="n-btn-url" className="text-sm font-medium text-muted-foreground">
              {t("buttonUrl")}
            </Label>
            <Input
              id="n-btn-url"
              value={buttonUrl}
              onChange={(e) => setButtonUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="n-push" className="text-sm font-medium text-muted-foreground">
            {t("pushTitle")}
          </Label>
          <Input
            id="n-push"
            value={pushTitle}
            onChange={(e) => setPushTitle(e.target.value)}
            placeholder={t("pushTitlePlaceholder")}
          />
        </div>

        <Button
          onClick={send}
          disabled={!valid || sending}
          className="h-[54px] gap-2 self-start px-8 text-base font-semibold"
        >
          {sending ? (
            <Spinner />
          ) : (
            <>
              <Megaphone className="size-4.5" />
              {t("send")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
