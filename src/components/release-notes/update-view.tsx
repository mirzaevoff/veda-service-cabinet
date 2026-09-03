"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Bell, Pencil, Pin, Send, Trash2, Undo2, Users } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { EditorRenderer } from "@/components/knowledge/editor/editor-renderer";
import type { ReleaseNote } from "@/lib/api";
import { releaseNotesApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { notifyUpdatesUnreadChanged } from "@/hooks/use-unread-updates";
import { Link, useRouter } from "@/i18n/navigation";
import { AreaBadge } from "./area-badge";

export function UpdateView({ noteId }: { noteId: string }) {
  const t = useTranslations("Updates");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.releaseNotesManage);

  const [note, setNote] = useState<ReleaseNote | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [inApp, setInApp] = useState(true);
  const [push, setPush] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    releaseNotesApi
      .get(noteId)
      .then((n) => {
        setNote(n);
        if (!n.read) {
          void releaseNotesApi
            .read(noteId)
            .then(() => notifyUpdatesUnreadChanged())
            .catch(() => {});
        }
      })
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else if (e && typeof e === "object" && "code" in e && e.code === "ER2100")
          router.replace("/updates");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => load(), [load]);

  async function publish() {
    setBusy(true);
    try {
      const updated = await releaseNotesApi.publish(noteId, { inApp, push });
      setNote(updated);
      setPublishOpen(false);
      notifyUpdatesUnreadChanged();
      toast.success(t("published"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    try {
      const updated = await releaseNotesApi.unpublish(noteId);
      setNote(updated);
      toast.success(t("unpublished"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await releaseNotesApi.remove(noteId);
      toast.success(t("deleted"));
      router.replace("/updates");
    } catch {
      toast.error(t("genericError"));
    }
  }

  if (!note) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso)
    );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        href="/updates"
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {note.pinned && <Pin className="size-4 text-primary" />}
            <h1 className="text-2xl font-bold">{note.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <AreaBadge area={note.area} frontVersion={note.frontVersion} apiVersion={note.apiVersion} />
            {note.important && (
              <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                {t("important")}
              </Badge>
            )}
            {canManage && (
              <Badge variant="secondary" className="gap-1">
                <Users className="size-3" />
                {t(note.audience === "all" ? "audienceAll" : "audienceStaff")}
              </Badge>
            )}
            {note.status === "draft" && (
              <Badge variant="secondary" className="bg-secondary text-muted-foreground">
                {t("statusDraft")}
              </Badge>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {note.status === "draft" ? (
              <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => setPublishOpen(true)}>
                <Send className="size-4" />
                {t("publish")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={unpublish}>
                <Undo2 className="size-4" />
                {t("unpublish")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/updates/${note.id}/edit`)}
            >
              <Pencil className="size-4" />
              {tc("edit")}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tc("delete")}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {note.summary && <p className="text-base text-muted-foreground">{note.summary}</p>}

      {note.content?.blocks?.length ? (
        <EditorRenderer content={note.content} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("noBody")}</p>
      )}

      <span className="text-xs text-muted-foreground">
        {note.author && t("author", { name: note.author.name })}
        {" · "}
        {note.publishedAt
          ? t("publishedOn", { time: fmtDate(note.publishedAt) })
          : t("createdOn", { time: fmtDate(note.createdAt) })}
      </span>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("publishTitle")}</DialogTitle>
            <DialogDescription>{t("publishHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <Bell className="size-4 text-muted-foreground" />
                {t("channelInApp")}
              </span>
              <Switch checked={inApp} onCheckedChange={setInApp} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <Send className="size-4 text-muted-foreground" />
                {t("channelPush")}
              </span>
              <Switch checked={push} onCheckedChange={setPush} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={busy} onClick={publish}>
              {busy ? <Spinner className="size-4" /> : t("publish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void remove()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
