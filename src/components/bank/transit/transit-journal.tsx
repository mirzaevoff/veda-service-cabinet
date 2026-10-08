"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Link2Off,
  ListChecks,
  Undo2,
  UserCheck,
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { DatePicker } from "@/components/common/date-picker";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { downloadBlob } from "@/components/invoices/invoice-format";
import {
  ApiError,
  type BankAccount,
  type TransitCard,
  type TransitJournal as Journal,
  type TransitJournalRow,
  type TransitRowKind,
  type TransitTransfer,
} from "@/lib/api";
import { bankApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDay } from "@/lib/format";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatTiyin } from "../bank-money";
import { StatementImportDialog } from "../statement-import-dialog";
import { AllocateDialog } from "./allocate-dialog";
import { UnknownCards } from "./unknown-cards";

type RowFilter = "all" | TransitRowKind | "review";

/** Журнал зарплатного транзита: остаток по КАЖДОМУ переводу, выплаты построчно */
export function TransitJournalPage({ accountId }: { accountId: string }) {
  const t = useTranslations("Bank.transit");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can, loading: userLoading } = useCurrentUser();
  const canView = can(PERMISSIONS.bankView);
  const canManage = can(PERMISSIONS.bankManage);

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [cards, setCards] = useState<TransitCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState<RowFilter>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [allocating, setAllocating] = useState<TransitJournalRow | null>(null);
  const [confirmPost, setConfirmPost] = useState(false);
  const [busy, setBusy] = useState<null | "rebuild" | "post" | "xlsx">(null);

  const load = useCallback(async () => {
    try {
      const [j, c, accs] = await Promise.all([
        bankApi.transit.journal(accountId, { from: from || undefined, to: to || undefined }),
        bankApi.transit.cards.list(),
        bankApi.accounts.list(),
      ]);
      setJournal(j);
      setCards(c);
      setAccount(accs.items.find((a) => a.id === accountId) ?? null);
      setError(null);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else if (e instanceof ApiError && e.code === "ER1216") setError(t("errors.notTransit"));
      else setError(tc("loadError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/t нестабильны
  }, [accountId, from, to]);

  useEffect(() => {
    if (!canView) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка данных при смене периода
    void load();
  }, [load, canView]);

  const employeeName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of cards) if (c.user) m[c.user.id] = c.user.name;
    return m;
  }, [cards]);

  const transferById = useMemo(() => {
    const m: Record<string, TransitTransfer> = {};
    for (const x of journal?.transfers ?? []) m[x.id] = x;
    return m;
  }, [journal]);

  async function rebuild() {
    setBusy("rebuild");
    try {
      const r = await bankApi.transit.rebuild(accountId);
      toast.success(t("rebuilt", { count: r.allocations }));
      await load();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(null);
    }
  }

  async function postPayouts() {
    setBusy("post");
    try {
      const r = await bankApi.transit.postPayouts(accountId);
      if (r.skippedNoEmployee > 0)
        toast.warning(t("postedPartial", { posted: r.posted, skipped: r.skippedNoEmployee }));
      else toast.success(t("posted", { posted: r.posted }));
      setConfirmPost(false);
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(null);
    }
  }

  async function downloadXlsx() {
    setBusy("xlsx");
    try {
      const blob = await bankApi.transit.journalXlsx(accountId, {
        from: from || undefined,
        to: to || undefined,
      });
      downloadBlob(blob, `transit-${from || "start"}-${to || "now"}.xlsx`);
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(null);
    }
  }

  async function unlink(row: TransitJournalRow, transferId: string) {
    try {
      await bankApi.transit.unallocate(row.id, transferId);
      toast.success(t("unlinked"));
      await load();
    } catch {
      toast.error(t("errors.generic"));
    }
  }

  if (!userLoading && !canView) return <NoAccess />;

  const rows = (journal?.rows ?? []).filter((r) =>
    filter === "all" ? true : filter === "review" ? r.unallocatedTiyin > 0 : r.kind === filter
  );
  const reviewCount = (journal?.rows ?? []).filter((r) => r.unallocatedTiyin > 0).length;
  /** Ни один расход ещё не привязан — значит, просто не нажимали «Разнести» */
  const nothingLinked = !(journal?.rows ?? []).some((r) => r.transferIds.length > 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <Link
        href="/finance?tab=bank"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      {/* Шапка */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-light">
            <WalletCards className="size-6 text-primary" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-2xl font-bold">{account?.title ?? t("title")}</h1>
            <span className="text-sm text-muted-foreground tabular-nums">
              {account ? `${account.account} · ${t("branch")} ${account.branch}` : t("subtitle")}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && account && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-4" />
              {t("import")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={busy !== null || !journal}
            onClick={() => void downloadXlsx()}
          >
            {busy === "xlsx" ? <Spinner className="size-4" /> : <Download className="size-4" />}
            Excel
          </Button>
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy !== null || !journal}
                onClick={() => void rebuild()}
                title={t("rebuildHint")}
              >
                {busy === "rebuild" ? <Spinner className="size-4" /> : <ListChecks className="size-4" />}
                {t("rebuild")}
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy !== null || !journal}
                onClick={() => setConfirmPost(true)}
              >
                <UserCheck className="size-4" />
                {t("postPayouts")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Период */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm text-muted-foreground">{t("period")}</Label>
          <div className="flex items-center gap-2">
            <DatePicker recent value={from} onChange={setFrom} placeholder={t("from")} />
            <span className="text-muted-foreground">—</span>
            <DatePicker recent value={to} onChange={setTo} placeholder={t("to")} />
          </div>
        </div>
        <span className="pb-2 text-xs text-muted-foreground">{t("periodHint")}</span>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" />
          {error}
        </div>
      ) : !journal ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : (
        <>
          {/* Сводка */}
          <div className="grid gap-2 sm:grid-cols-4">
            <Tile label={t("opening")} value={formatTiyin(journal.openingTiyin)} />
            <Tile label={t("closing")} value={formatTiyin(journal.closingTiyin)} strong />
            <Tile
              label={t("undistributed")}
              hint={t("undistributedHint")}
              value={formatTiyin(journal.undistributedTiyin)}
              tone={journal.undistributedTiyin !== 0 ? "warning" : undefined}
            />
            <Tile
              label={t("needsReview")}
              hint={t("needsReviewHint")}
              value={formatTiyin(journal.needsReviewTiyin)}
              tone={journal.needsReviewTiyin !== 0 ? "danger" : undefined}
            />
          </div>

          {/* Не разнесено вовсе: у переводов есть остаток, а расходы ни к чему не привязаны —
              это не «вернули после раздачи», а просто ещё не нажали «Разнести» */}
          {journal.needsReviewTiyin !== 0 && nothingLinked && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-light/40 p-4">
              <ListChecks className="size-5 shrink-0 text-warning" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <span className="font-medium text-warning">{t("notDistributedTitle")}</span>
                <span className="text-muted-foreground">{t("notDistributedText")}</span>
              </div>
              {canManage && (
                <Button size="sm" disabled={busy !== null} onClick={() => void rebuild()} className="gap-1.5">
                  {busy === "rebuild" ? <Spinner className="size-4" /> : <ListChecks className="size-4" />}
                  {t("rebuild")}
                </Button>
              )}
            </div>
          )}

          {/* На проверке — рабочий экран, а не техническое поле */}
          {journal.needsReviewTiyin !== 0 && !nothingLinked && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <CircleAlert className="size-5 shrink-0 text-destructive" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <span className="font-medium text-destructive">
                  {t("reviewTitle", { sum: formatTiyin(journal.needsReviewTiyin), count: reviewCount })}
                </span>
                <span className="text-muted-foreground">{t("reviewText")}</span>
                {canManage && (
                  <span className="text-xs text-muted-foreground">{t("reviewRebuildHint")}</span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setFilter("review")}>
                {t("showReview")}
              </Button>
            </div>
          )}

          <UnknownCards cards={journal.unknownCards} canManage={canManage} onLinked={() => void load()} />

          {/* Остаток по КАЖДОМУ переводу */}
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("transfersTitle", { count: journal.transfers.length })}
            </h2>
            {journal.transfers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                {t("noTransfers")}
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t("colDate")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colTransfer")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colAllocated")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colRemaining")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {journal.transfers.map((x) => (
                      <tr key={x.id}>
                        <td className="px-3 py-2 tabular-nums">{formatDay(x.date, locale)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatTiyin(x.totalTiyin)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {formatTiyin(x.allocatedTiyin)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right font-semibold tabular-nums",
                            x.remainingTiyin !== 0 && "text-warning"
                          )}
                        >
                          {formatTiyin(x.remainingTiyin)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={x.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Выписка: каждая выплата отдельной строкой, с остатком после неё */}
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("journalTitle")}
              </h2>
              <div className="flex flex-wrap gap-1 rounded-lg border border-border p-0.5">
                {(["all", "transfer", "payout", "return", "review"] as RowFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      filter === f
                        ? f === "review"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-accent-light text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(`filter.${f}`)}
                    {f === "review" && reviewCount > 0 && ` (${reviewCount})`}
                  </button>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                {journal.rows.length === 0 ? t("emptyJournal") : t("emptyFilter")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-secondary/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t("colDate")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("colWho")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colIn")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colOut")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colBalance")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <JournalLine
                        key={r.id}
                        row={r}
                        employeeName={r.employeeId ? employeeName[r.employeeId] : undefined}
                        transferById={transferById}
                        canManage={canManage}
                        onAllocate={() => setAllocating(r)}
                        onUnlink={(transferId) => void unlink(r, transferId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <StatementImportDialog
        open={importOpen}
        account={account}
        onClose={() => setImportOpen(false)}
        onImported={() => void load()}
      />

      <AllocateDialog
        row={allocating}
        transfers={journal?.transfers ?? []}
        onClose={() => setAllocating(null)}
        onDone={() => void load()}
      />

      <AlertDialog open={confirmPost} onOpenChange={setConfirmPost}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("postConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("postConfirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "post"}
              onClick={(e) => {
                e.preventDefault();
                void postPayouts();
              }}
            >
              {busy === "post" ? <Spinner className="size-4" /> : t("postPayouts")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function JournalLine({
  row,
  employeeName,
  transferById,
  canManage,
  onAllocate,
  onUnlink,
}: {
  row: TransitJournalRow;
  employeeName?: string;
  transferById: Record<string, TransitTransfer>;
  canManage: boolean;
  onAllocate: () => void;
  onUnlink: (transferId: string) => void;
}) {
  const t = useTranslations("Bank.transit");
  const locale = useLocale();
  const review = row.unallocatedTiyin > 0;
  const transferDate = (id: string) =>
    transferById[id] ? formatDay(transferById[id].date, locale) : "—";

  // Направление по деньгам, а не по типу: «прочее» бывает и приходом (вернулась выплата)
  const Icon = row.kind === "return" ? Undo2 : row.inTiyin > 0 ? ArrowDownLeft : ArrowUpRight;

  return (
    <tr className={cn(review && "bg-destructive/5", row.kind === "transfer" && "bg-secondary/30")}>
      <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums text-muted-foreground">
        {formatDay(row.date, locale)}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-start gap-2">
          <Icon
            className={cn(
              "mt-0.5 size-4 shrink-0",
              row.kind === "transfer" ? "text-success" : "text-muted-foreground"
            )}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className={cn("font-medium", row.kind === "transfer" && "text-foreground")}>
                {row.kind === "payout" && employeeName ? employeeName : row.party || "—"}
              </span>
              <Badge variant="secondary" className="font-normal text-muted-foreground">
                {t(`kind.${row.kind}`)}
              </Badge>
            </span>
            {row.kind === "payout" && employeeName && row.party && (
              <span className="text-xs text-muted-foreground">{t("bankName", { name: row.party })}</span>
            )}
            {row.kind === "payout" && !row.employeeId && (
              <span className="text-xs text-warning">{t("cardNotLinked")}</span>
            )}

            {/* К каким переводам относится расход */}
            {row.allocations && row.allocations.length > 0 ? (
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {row.allocations.map((a) => (
                  <li key={a.transferId} className="flex items-center gap-1.5">
                    <span>
                      {t("fromTransfer", { date: transferDate(a.transferId), sum: formatTiyin(a.amountTiyin) })}
                    </span>
                    {!a.auto && <span className="text-primary">· {t("manualLink")}</span>}
                    {!a.auto && canManage && (
                      <button
                        type="button"
                        onClick={() => onUnlink(a.transferId)}
                        className="inline-flex items-center gap-0.5 text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                      >
                        <Link2Off className="size-3" />
                        {t("unlink")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : row.transferIds.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {t("fromTransfers", { dates: row.transferIds.map(transferDate).join(", ") })}
              </span>
            ) : null}

            {review && (
              <span className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-destructive">
                  {t("unallocated", { sum: formatTiyin(row.unallocatedTiyin) })}
                </span>
                {canManage && (
                  <Button variant="outline" size="xs" onClick={onAllocate}>
                    {t("allocateAction")}
                  </Button>
                )}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-success">
        {row.inTiyin ? `+${formatTiyin(row.inTiyin)}` : ""}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums">
        {row.outTiyin ? `−${formatTiyin(row.outTiyin)}` : ""}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-medium tabular-nums">
        {formatTiyin(row.balanceAfterTiyin)}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: TransitTransfer["status"] }) {
  const t = useTranslations("Bank.transit.status");
  const cls =
    status === "full"
      ? "bg-success-light text-success"
      : status === "partial"
        ? "bg-warning-light text-warning"
        : "bg-secondary text-muted-foreground";
  return (
    <Badge variant="secondary" className={cls}>
      {t(status)}
    </Badge>
  );
}

function Tile({
  label,
  value,
  hint,
  strong,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  tone?: "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        tone === "danger"
          ? "border-destructive/40 bg-destructive/5"
          : tone === "warning"
            ? "border-warning/40 bg-warning-light/30"
            : "border-border"
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-xl font-bold" : "text-lg font-semibold",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[11px] leading-tight text-muted-foreground">{hint}</span>}
    </div>
  );
}
