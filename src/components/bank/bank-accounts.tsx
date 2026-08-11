"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Landmark, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { BankAccount } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { formatRelativeTime } from "@/lib/format";
import { formatTiyin } from "./bank-money";

/** Отслеживаемые счета: снапшоты остатков, ручной синк, добавление */
export function BankAccounts({
  accounts,
  onChanged,
}: {
  accounts: BankAccount[] | null;
  onChanged: () => void;
}) {
  const t = useTranslations("Bank.accounts");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.bankManage);

  const [creating, setCreating] = useState(false);
  const [branch, setBranch] = useState("");
  const [account, setAccount] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);

  async function create() {
    if (!/^\d{5}$/.test(branch) || !/^\d{20}$/.test(account) || !title.trim()) {
      setError(t("validation"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await bankApi.accounts.create({ branch, account, title: title.trim() });
      toast.success(t("created"));
      setCreating(false);
      setBranch("");
      setAccount("");
      setTitle("");
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1203") setError(t("duplicate"));
      else setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(acc: BankAccount, enabled: boolean) {
    try {
      await bankApi.accounts.update(acc.id, { enabled });
      onChanged();
    } catch {
      toast.error(t("genericError"));
    }
  }

  async function sync(acc: BankAccount) {
    setSyncingId(acc.id);
    try {
      const result = await bankApi.accounts.sync(acc.id);
      toast.success(t("synced", { upserted: result.upserted }));
      onChanged();
    } catch {
      toast.error(t("syncFailed"));
    } finally {
      setSyncingId(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await bankApi.accounts.remove(deleting.id);
      toast.success(t("deleted"));
      setDeleting(null);
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1206")
        toast.error(t("hasHistory"));
      else toast.error(t("genericError"));
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <Button onClick={() => setCreating(true)} className="gap-2 self-start">
          <Plus className="size-4" />
          {t("add")}
        </Button>
      )}

      {accounts === null ? null : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <Landmark className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((acc, i) => (
            <Card
              key={acc.id}
              className={`gap-3 rounded-lg p-5 duration-450 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:backwards] ${acc.enabled ? "" : "opacity-60"}`}
              style={{ animationDelay: `${Math.min(i * 60, 240)}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light">
                  <Landmark className="size-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="truncate font-semibold">{acc.title}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {acc.account}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t("branch")}: {acc.branch}
                    {acc.snapshot?.stateName && ` · ${acc.snapshot.stateName}`}
                  </span>
                </div>
                {canManage && (
                  <Switch
                    checked={acc.enabled}
                    onCheckedChange={(v) => toggleEnabled(acc, v)}
                    aria-label={t("enabled")}
                  />
                )}
              </div>

              {acc.snapshot && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">{t("balance")}</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {formatTiyin(acc.snapshot.s_out)}
                  </dd>
                  <dt className="text-muted-foreground">{t("available")}</dt>
                  <dd className="text-right tabular-nums">
                    {formatTiyin(acc.snapshot.canpay)}
                  </dd>
                  <dt className="text-muted-foreground">{t("turnovers")}</dt>
                  <dd className="text-right text-xs tabular-nums">
                    −{formatTiyin(acc.snapshot.dt)} / +{formatTiyin(acc.snapshot.ct)}
                  </dd>
                </dl>
              )}

              {acc.lastSyncError && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  {acc.lastSyncError}
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {acc.lastSyncOkAt
                    ? t("lastSync", {
                        time: formatRelativeTime(acc.lastSyncOkAt, locale),
                      })
                    : t("neverSynced")}
                </span>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={syncingId === acc.id}
                      aria-label={t("syncNow")}
                      onClick={() => sync(acc)}
                      className="text-muted-foreground"
                    >
                      {syncingId === acc.id ? (
                        <Spinner className="size-4" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("delete")}
                      onClick={() => setDeleting(acc)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Добавление счёта */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("add")}</DialogTitle>
            <DialogDescription>{t("addHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ba-title" className="text-sm font-medium text-muted-foreground">
                {t("title")}
              </Label>
              <Input
                id="ba-title"
                value={title}
                maxLength={200}
                placeholder={t("titlePlaceholder")}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ba-branch" className="text-sm font-medium text-muted-foreground">
                  {t("branch")}
                </Label>
                <Input
                  id="ba-branch"
                  value={branch}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="01158"
                  onChange={(e) => {
                    setBranch(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  className="tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ba-account" className="text-sm font-medium text-muted-foreground">
                  {t("account")}
                </Label>
                <Input
                  id="ba-account"
                  value={account}
                  inputMode="numeric"
                  maxLength={20}
                  placeholder="20208000900000000001"
                  onChange={(e) => {
                    setAccount(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  className="tabular-nums"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("immutableHint")}</p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={create} disabled={busy}>
              {busy ? <Spinner className="size-4" /> : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteConfirmTitle", { title: deleting?.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
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
