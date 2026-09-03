"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, KeyRound, Plus, Trash2, TriangleAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { DatePicker } from "@/components/common/date-picker";
import type { ApiToken, ApiTokenCreated, Role } from "@/lib/api";
import { adminApi, apiTokensApi, SessionExpiredError } from "@/lib/api-authed";
import { useDelayed } from "@/hooks/use-delayed";
import { pickLocalized } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const STATE_STYLES: Record<ApiToken["state"], string> = {
  active: "bg-success-light text-success",
  revoked: "bg-secondary text-muted-foreground",
  expired: "bg-warning-light text-warning",
};

export function ApiTokensManager() {
  const t = useTranslations("ApiTokens");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const showSkeleton = useDelayed(!tokens);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);

  const [secret, setSecret] = useState<ApiTokenCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);

  const load = useCallback(() => {
    apiTokensApi
      .list()
      .then(setTokens)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else setTokens([]);
      });
  }, [router]);

  useEffect(() => {
    load();
    void adminApi.roles.list().then(setRoles).catch(() => {});
  }, [load]);

  async function create() {
    if (!name.trim() || !roleId) {
      toast.error(t("nameRoleRequired"));
      return;
    }
    setCreating(true);
    try {
      const created = await apiTokensApi.create({
        name: name.trim(),
        roleId,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.999Z`).toISOString() : null,
      });
      setCreateOpen(false);
      setName("");
      setRoleId("");
      setExpiresAt("");
      setCopied(false);
      setSecret(created);
      load();
    } catch {
      toast.error(t("createError"));
    } finally {
      setCreating(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyError"));
    }
  }

  async function revoke() {
    if (!revoking) return;
    try {
      await apiTokensApi.remove(revoking.id);
      toast.success(t("revoked"));
      setRevoking(null);
      load();
    } catch {
      toast.error(t("genericError"));
    }
  }

  const fmtDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
      : "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">{t("intro")}</p>
        <Button className="gap-2 shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t("create")}
        </Button>
      </div>

      {!tokens ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : tokens.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <KeyRound className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tokens.map((tok) => (
            <div
              key={tok.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border p-4 duration-450 animate-in fade-in"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{tok.name}</span>
                  <Badge variant="secondary" className={cn("font-normal", STATE_STYLES[tok.state])}>
                    {t(`state.${tok.state}`)}
                  </Badge>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{tok.prefix}</span>
                <span className="text-xs text-muted-foreground">
                  {tok.user?.name}
                  {" · "}
                  {t("lastUsed", { time: tok.lastUsedAt ? fmtDate(tok.lastUsedAt) : t("never") })}
                  {tok.expiresAt && ` · ${t("expires", { time: fmtDate(tok.expiresAt) })}`}
                </span>
              </div>
              {tok.state === "active" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("revoke")}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setRevoking(tok)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Диалог выпуска токена */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription>{t("createHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("nameLabel")}</Label>
              <Input value={name} maxLength={100} placeholder={t("namePlaceholder")} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("roleLabel")}</Label>
              <Select
                value={roleId}
                items={Object.fromEntries(roles.map((r) => [r.id, pickLocalized(r.title, locale) || r.slug]))}
                onValueChange={(v) => setRoleId(v ?? "")}
              >
                <SelectTrigger><SelectValue placeholder={t("rolePlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {pickLocalized(r.title, locale) || r.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{t("roleHint")}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("expiresLabel")}</Label>
              <DatePicker value={expiresAt} onChange={setExpiresAt} placeholder={t("expiresPlaceholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={creating} onClick={() => void create()}>
              {creating ? <Spinner className="size-4" /> : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Секрет — показывается один раз */}
      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("secretTitle")}</DialogTitle>
            <DialogDescription>{t("secretHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-light/50 p-3 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{t("secretWarning")}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-xs">{secret?.token}</code>
            <Button variant="outline" size="icon-sm" aria-label={t("copy")} onClick={() => void copySecret()}>
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>{t("secretDone")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revoking} onOpenChange={(o) => !o && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeConfirmTitle", { name: revoking?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("revokeConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void revoke()} className="bg-destructive text-white hover:bg-destructive/90">
              {t("revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
