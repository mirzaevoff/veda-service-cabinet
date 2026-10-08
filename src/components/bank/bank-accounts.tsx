"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpenText,
  Building2,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
  WalletCards,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { BankAccount, CashCategory } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDay, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { AccountFormDialog } from "./account-form-dialog";
import { formatTiyin } from "./bank-money";
import { ManualOperationDialog } from "./manual-operation-dialog";
import { StatementImportDialog } from "./statement-import-dialog";
import { useEntityNames } from "./use-entity-names";

/**
 * Счета: синхронизируемые (Капиталбанк, тянутся сами), ручные счета и карты.
 * Ручным — операции вручную и загрузка выписки; синхронизируемым их нет вовсе.
 */
export function BankAccounts({
  accounts,
  categories,
  onChanged,
  onOperationsChanged,
}: {
  accounts: BankAccount[] | null;
  categories: CashCategory[];
  onChanged: () => void;
  /** Операции изменились (ручной ввод / импорт) — освежить список транзакций */
  onOperationsChanged: () => void;
}) {
  const t = useTranslations("Bank.accounts");
  const tc = useTranslations("Common");
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.bankManage);
  const names = useEntityNames((accounts ?? []).map((a) => a.legalEntityId));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [operationFor, setOperationFor] = useState<BankAccount | null>(null);
  const [importFor, setImportFor] = useState<BankAccount | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);

  const synced = (accounts ?? []).filter((a) => a.kind !== "manual");
  const manual = (accounts ?? []).filter((a) => a.kind === "manual" && a.form === "account");
  const transits = (accounts ?? []).filter((a) => a.form === "transit");
  const cards = (accounts ?? []).filter((a) => a.kind === "manual" && a.form === "card");

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
      onOperationsChanged();
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
      if (e instanceof ApiError && e.code === "ER1206") toast.error(t("hasHistory"));
      else toast.error(t("genericError"));
      setDeleting(null);
    }
  }

  const actions = (acc: BankAccount) =>
    canManage && (
      <div className="flex items-start gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" className="gap-1.5" onClick={() => setOperationFor(acc)}>
            <Plus className="size-4" />
            {t("addOperation")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportFor(acc)}>
            <FileSpreadsheet className="size-4" />
            {t("importStatement")}
          </Button>
        </div>
        <div className="ms-auto flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("edit")}
            onClick={() => {
              setEditing(acc);
              setFormOpen(true);
            }}
            className="text-muted-foreground"
          >
            <Pencil className="size-4" />
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
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="gap-2 self-start"
        >
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
        <>
          {/* Ручные счета */}
          {manual.length > 0 && (
            <Section title={t("groupManual")} hint={t("groupManualHint")}>
              {manual.map((acc) => (
                <Card key={acc.id} className="gap-3 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Landmark className="size-5 text-muted-foreground" strokeWidth={1.75} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="truncate font-semibold">{acc.title}</h3>
                      <span className="text-xs text-muted-foreground tabular-nums">{acc.account}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t("branch")}: {acc.branch}
                      </span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-muted-foreground">
                      {t("manualBadge")}
                    </Badge>
                  </div>
                  <ManualBalance acc={acc} entity={names[acc.legalEntityId ?? ""]} />
                  {actions(acc)}
                </Card>
              ))}
            </Section>
          )}

          {/* Зарплатный транзит: выписка банка уже расшифрована по сотрудникам */}
          {transits.length > 0 && (
            <Section title={t("groupTransit")} hint={t("groupTransitHint")}>
              {transits.map((acc) => (
                <Card key={acc.id} className="gap-3 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light">
                      <WalletCards className="size-5 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="truncate font-semibold">{acc.title}</h3>
                      <span className="text-xs text-muted-foreground tabular-nums">{acc.account}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t("branch")}: {acc.branch}
                      </span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 bg-accent-light text-primary">
                      {t("transitBadge")}
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{t("balance")}</span>
                    <span className="text-lg font-bold tabular-nums">{formatTiyin(acc.balanceTiyin)}</span>
                  </div>
                  {acc.legalEntityId && names[acc.legalEntityId] && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="size-3" />
                      {names[acc.legalEntityId]}
                    </span>
                  )}
                  <div className="flex items-start gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/finance/transit/${acc.id}`}
                        className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                      >
                        <BookOpenText className="size-4" />
                        {t("transitJournal")}
                      </Link>
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setImportFor(acc)}
                        >
                          <FileSpreadsheet className="size-4" />
                          {t("importStatement")}
                        </Button>
                      )}
                    </div>
                    {canManage && (
                      <div className="ms-auto flex shrink-0 items-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("edit")}
                          onClick={() => {
                            setEditing(acc);
                            setFormOpen(true);
                          }}
                          className="text-muted-foreground"
                        >
                          <Pencil className="size-4" />
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
            </Section>
          )}

          {/* Карты — карточкой, это другой объект */}
          {cards.length > 0 && (
            <Section title={t("groupCards")} hint={t("groupCardsHint")}>
              {cards.map((acc) => (
                <div key={acc.id} className="flex flex-col gap-3">
                  <div className="relative flex aspect-[1.7/1] max-h-48 flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 p-5 text-white shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white/90">{acc.title}</span>
                      <CreditCard className="size-6 shrink-0 text-white/70" strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] uppercase tracking-wider text-white/50">
                        {t("balance")}
                      </span>
                      <span className="text-2xl font-bold tabular-nums">
                        {formatTiyin(acc.balanceTiyin)}{" "}
                        <span className="text-sm font-medium text-white/60">{acc.currency || "UZS"}</span>
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <span className="font-mono text-base tracking-widest tabular-nums">{acc.account}</span>
                      {acc.legalEntityId && names[acc.legalEntityId] && (
                        <span className="max-w-[55%] truncate text-xs text-white/60">
                          {names[acc.legalEntityId]}
                        </span>
                      )}
                    </div>
                  </div>
                  {acc.openingDate && (
                    <span className="text-xs text-muted-foreground">
                      <OpeningLine acc={acc} />
                    </span>
                  )}
                  {actions(acc)}
                </div>
              ))}
            </Section>
          )}

          {/* Синхронизируемые — как раньше */}
          {synced.length > 0 && (
            <Section title={t("groupSynced")} hint={t("groupSyncedHint")}>
              {synced.map((acc) => (
                <SyncedCard
                  key={acc.id}
                  acc={acc}
                  canManage={canManage}
                  syncing={syncingId === acc.id}
                  onSync={() => sync(acc)}
                  onToggle={(v) => toggleEnabled(acc, v)}
                  onDelete={() => setDeleting(acc)}
                />
              ))}
            </Section>
          )}
        </>
      )}

      <AccountFormDialog
        open={formOpen}
        account={editing}
        entityName={editing?.legalEntityId ? names[editing.legalEntityId] : undefined}
        onClose={() => setFormOpen(false)}
        onSaved={onChanged}
      />

      <ManualOperationDialog
        open={!!operationFor}
        account={operationFor}
        categories={categories}
        onClose={() => setOperationFor(null)}
        onSaved={() => {
          onChanged();
          onOperationsChanged();
        }}
      />

      <StatementImportDialog
        open={!!importFor}
        account={importFor}
        onClose={() => setImportFor(null)}
        onImported={() => {
          onChanged();
          onOperationsChanged();
        }}
      />

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

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function OpeningLine({ acc }: { acc: BankAccount }) {
  const t = useTranslations("Bank.accounts");
  const locale = useLocale();
  if (!acc.openingDate) return null;
  return (
    <>
      {t("openingLine", {
        sum: formatTiyin(acc.openingBalanceTiyin),
        date: formatDay(acc.openingDate, locale),
      })}
    </>
  );
}

function ManualBalance({ acc, entity }: { acc: BankAccount; entity?: string }) {
  const t = useTranslations("Bank.accounts");
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{t("balance")}</span>
        <span className="text-lg font-bold tabular-nums">{formatTiyin(acc.balanceTiyin)}</span>
      </div>
      <span className="text-xs text-muted-foreground">
        <OpeningLine acc={acc} />
      </span>
      {entity && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="size-3" />
          {entity}
        </span>
      )}
    </div>
  );
}

function SyncedCard({
  acc,
  canManage,
  syncing,
  onSync,
  onToggle,
  onDelete,
}: {
  acc: BankAccount;
  canManage: boolean;
  syncing: boolean;
  onSync: () => void;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("Bank.accounts");
  const tc = useTranslations("Common");
  const locale = useLocale();
  return (
    <Card className={cn("gap-3 rounded-lg p-5", !acc.enabled && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-light">
          <Landmark className="size-5 text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate font-semibold">{acc.title}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{acc.account}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("branch")}: {acc.branch}
            {acc.snapshot?.stateName && ` · ${acc.snapshot.stateName}`}
          </span>
        </div>
        {canManage && (
          <Switch checked={acc.enabled} onCheckedChange={onToggle} aria-label={t("enabled")} />
        )}
      </div>

      {acc.snapshot && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("balance")}</dt>
          <dd className="text-right font-semibold tabular-nums">{formatTiyin(acc.snapshot.s_out)}</dd>
          <dt className="text-muted-foreground">{t("available")}</dt>
          <dd className="text-right tabular-nums">{formatTiyin(acc.snapshot.canpay)}</dd>
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
            ? t("lastSync", { time: formatRelativeTime(acc.lastSyncOkAt, locale) })
            : t("neverSynced")}
        </span>
        {canManage && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={syncing}
              aria-label={t("syncNow")}
              onClick={onSync}
              className="text-muted-foreground"
            >
              {syncing ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tc("delete")}
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
