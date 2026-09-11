"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArrowLeft,
  Check,
  ClipboardCheck,
  History,
  Paperclip,
  Pencil,
  Send,
  ShieldCheck,
  Trash2,
  Users,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { EditorRenderer } from "@/components/knowledge/editor/editor-renderer";
import { fileProxyUrl } from "@/components/knowledge/editor/shared";
import { ApiError, type DocumentDetail } from "@/lib/api";
import { documentsApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { formatRelativeTime, formatTashkentDateTime } from "@/lib/format";
import { Link, useRouter } from "@/i18n/navigation";
import { documentStatusStyle, logActionKey } from "./documents-format";
import { DocumentTypeBadge } from "./document-type-badge";

export function DocumentView({ id }: { id: string }) {
  const t = useTranslations("Documents");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useCurrentUser();
  const canManage = can(PERMISSIONS.documentsManage);
  const canConfirm = can(PERMISSIONS.documentsConfirm);

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    documentsApi
      .get(id)
      .then(setDoc)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else if (e instanceof ApiError && e.code === "ER2300") router.replace("/documents");
        else toast.error(tc("loadError"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => load(), [load]);

  function handleError(e: unknown) {
    if (e instanceof SessionExpiredError) {
      router.replace("/login");
      return;
    }
    if (e instanceof ApiError) {
      if (e.code === "ER2305") return void toast.error(t("alreadyConfirmed"));
      if (e.code === "ER2306") return void toast.error(t("cannotConfirmOwn"));
      if (e.code === "ER2304") return void toast.error(t("actionNotAllowed"));
    }
    toast.error(t("genericError"));
  }

  async function run(fn: () => Promise<DocumentDetail>, successKey: string) {
    setBusy(true);
    try {
      setDoc(await fn());
      toast.success(t(successKey));
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await documentsApi.remove(id);
      toast.success(t("deleted"));
      router.replace("/documents");
    } catch (e) {
      handleError(e);
    }
  }

  if (!doc) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const isAuthor = !!user && doc.author?.id === user.id;
  const hasConfirmed = !!user && doc.confirmations.some((c) => c.user.id === user.id);
  const isAddressed =
    doc.audience === "all" || (!!user && doc.visibleTo.some((v) => v.id === user.id));
  const hasAcknowledged = !!user && doc.acknowledgments.some((a) => a.user.id === user.id);

  const showConfirm = doc.status === "pending" && canConfirm && !isAuthor && !hasConfirmed;
  const showAcknowledge = doc.status === "active" && isAddressed && !hasAcknowledged;
  const showEdit = canManage && doc.status !== "archived";
  const showSubmit = canManage && doc.status === "draft";
  const showArchive = canManage && doc.status === "active";
  const showDelete = canManage && doc.status === "draft";

  const showConfirmationsBlock = doc.requiredConfirmations > 0 || doc.confirmations.length > 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        href="/documents"
        className="flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-bold">{doc.title}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {doc.type && <DocumentTypeBadge type={doc.type} />}
            <Badge variant="secondary" className={documentStatusStyle(doc.status)}>
              {t(`status.${doc.status}`)}
            </Badge>
            {canManage && (
              <Badge variant="secondary" className="gap-1">
                <Users className="size-3" />
                {doc.audience === "all" ? t("audienceAllShort") : t("audienceSpecificShort")}
              </Badge>
            )}
            {doc.tags.map((x) => (
              <span
                key={x}
                className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                #{x}
              </span>
            ))}
          </div>
        </div>

        {(showEdit || showSubmit || showArchive || showDelete) && (
          <div className="flex flex-wrap items-center gap-2">
            {showSubmit && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={() => void run(() => documentsApi.submit(id), "submitted")}
              >
                <Send className="size-4" />
                {t("submit")}
              </Button>
            )}
            {showArchive && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={() => void run(() => documentsApi.archive(id), "archivedToast")}
              >
                <Archive className="size-4" />
                {t("archive")}
              </Button>
            )}
            {showEdit && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => router.push(`/documents/${id}/edit`)}
              >
                <Pencil className="size-4" />
                {t("edit")}
              </Button>
            )}
            {showDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={tc("delete")}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {doc.content?.blocks?.length ? (
        <EditorRenderer content={doc.content} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("noBody")}</p>
      )}

      {doc.attachments.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("attachments")}
          </span>
          <div className="flex flex-col gap-1">
            {doc.attachments.map((f) => (
              <a
                key={f.id}
                href={fileProxyUrl(f.url)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.originalName}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {showConfirmationsBlock && (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <span className="font-medium">{t("confirmationsTitle")}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("confirmedOf", {
              count: doc.confirmations.length,
              required: doc.requiredConfirmations,
            })}
          </p>
          {doc.confirmations.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {doc.confirmations.map((c) => (
                <li key={c.user.id} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 shrink-0 text-success" />
                  <span>{c.user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTashkentDateTime(c.at, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {showConfirm && (
            <div className="flex flex-col gap-1.5">
              <Button
                size="sm"
                className="gap-1.5 self-start"
                disabled={busy}
                onClick={() => void run(() => documentsApi.confirm(id), "confirmed")}
              >
                {busy ? <Spinner className="size-4" /> : <Check className="size-4" />}
                {t("confirmButton")}
              </Button>
              <span className="text-xs text-muted-foreground">{t("confirmHint")}</span>
            </div>
          )}
        </section>
      )}

      {(doc.status === "active" || doc.acknowledgments.length > 0) && (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-muted-foreground" />
            <span className="font-medium">{t("ackTitle")}</span>
          </div>
          {showAcknowledge ? (
            <Button
              size="sm"
              className="gap-1.5 self-start"
              disabled={busy}
              onClick={() => void run(() => documentsApi.acknowledge(id), "acknowledged")}
            >
              {busy ? <Spinner className="size-4" /> : <Check className="size-4" />}
              {t("ackButton")}
            </Button>
          ) : (
            hasAcknowledged && (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <Check className="size-4" />
                {t("ackDone")}
              </p>
            )
          )}
          {canManage && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ackWho")}
              </span>
              {doc.acknowledgments.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {doc.acknowledgments.map((a) => (
                    <li key={a.user.id} className="flex items-center gap-2 text-sm">
                      <Check className="size-4 shrink-0 text-muted-foreground" />
                      <span>{a.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTashkentDateTime(a.at, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("ackNobody")}</p>
              )}
            </div>
          )}
        </section>
      )}

      {doc.log.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <span className="font-medium">{t("logTitle")}</span>
          </div>
          <ul className="flex flex-col gap-3">
            {doc.log.map((entry, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <div className="mt-1 size-2 shrink-0 rounded-full bg-border" />
                <div className="flex min-w-0 flex-col">
                  <span>{t(`log.${logActionKey(entry.action)}`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.user && `${entry.user.name} · `}
                    {formatTashkentDateTime(entry.at, locale)}
                  </span>
                  {entry.note && (
                    <span className="text-xs text-muted-foreground">{entry.note}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <span className="text-xs text-muted-foreground">
        {doc.author && t("author", { name: doc.author.name })}
        {" · "}
        {doc.activatedAt
          ? t("activated", { time: formatRelativeTime(doc.activatedAt, locale) })
          : t("updated", { time: formatRelativeTime(doc.updatedAt, locale) })}
      </span>

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
