"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, CheckCircle2, FileText, Play, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { ApiError, type ChainInvoicePreview, type Invoice, type Venue } from "@/lib/api";
import { chainInvoicesApi, invoicesApi, venuesApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { formatTiyin } from "@/lib/format";
import { Link, useRouter } from "@/i18n/navigation";
import { minorToTiyin } from "./chain-format";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Открыть PDF счёта во вкладке (authed blob → objectURL) */
async function openPdf(id: string, onError: () => void) {
  try {
    const blob = await invoicesApi.pdfBlob(id);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    onError();
  }
}

export function ChainInvoices({
  onFixUnmapped,
}: {
  /** Открыть «Справочник продуктов» с предзаполнением (из мастера) */
  onFixUnmapped?: (chainClientId: string, name: string) => void;
} = {}) {
  const t = useTranslations("ChainInvoices");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.iikoInvoicesManage);

  const [chains, setChains] = useState<Venue[]>([]);
  const [chainClientId, setChainClientId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());

  const [preview, setPreview] = useState<ChainInvoicePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  /** legalEntityId в процессе выпуска, или "all" */
  const [issuing, setIssuing] = useState<string | null>(null);
  /** ЮЛ, по которым счета уже выпущены в этой сессии */
  const [issuedIds, setIssuedIds] = useState<Set<string>>(new Set());
  const [created, setCreated] = useState<Invoice[]>([]);

  useEffect(() => {
    void venuesApi
      .list({ kind: "chain", limit: 200, sort: "name" })
      .then((p) => setChains(p.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при смене сети/периода
    setPreview(null);
    setIssuedIds(new Set());
    setCreated([]);
  }, [chainClientId, period]);

  async function runPreview() {
    if (!chainClientId || !period) return;
    setPreviewing(true);
    try {
      setPreview(await chainInvoicesApi.preview(chainClientId, period));
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("previewError"));
    } finally {
      setPreviewing(false);
    }
  }

  const issue = useCallback(
    async (legalEntityId?: string) => {
      setIssuing(legalEntityId ?? "all");
      try {
        const invoices = await chainInvoicesApi.issue(chainClientId, period, legalEntityId);
        logActivity({
          type: "chainInvoice.issue",
          category: "Счета iiko",
          description: "Выпуск счетов сети",
          meta: { chainClientId, period, count: invoices.length },
        });
        setIssuedIds((prev) => {
          const next = new Set(prev);
          invoices.forEach((inv) => inv.legalEntityId && next.add(inv.legalEntityId));
          return next;
        });
        setCreated((prev) => [...invoices, ...prev]);
        toast.success(t("issuedToast", { count: invoices.length }));
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) toast.error(t("issueExists"));
        else toast.error(t("genericError"));
      } finally {
        setIssuing(null);
      }
    },
    [chainClientId, period, t]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("chain")}</label>
          <Select
            value={chainClientId}
            items={Object.fromEntries(chains.map((c) => [c.iikoClientId, c.name]))}
            onValueChange={(v) => setChainClientId(v ?? "")}
          >
            <SelectTrigger className="h-9 w-64">
              <SelectValue placeholder={t("chainPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {chains.map((c) => (
                <SelectItem key={c.id} value={c.iikoClientId}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("period")}</label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-9 w-40 tabular-nums"
          />
        </div>
        <Button onClick={runPreview} disabled={!chainClientId || !period || previewing} className="gap-2">
          {previewing ? <Spinner className="size-4" /> : <Play className="size-4" />}
          {t("preview")}
        </Button>
      </div>

      {!chainClientId ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <FileText className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("pickChain")}</p>
        </div>
      ) : (
        <>
          {previewing && !preview && <Skeleton className="h-40 rounded-lg" />}

          {preview && (
            <PreviewPanel
              preview={preview}
              locale={locale}
              canManage={canManage}
              issuing={issuing}
              issuedIds={issuedIds}
              onIssue={issue}
              onFixUnmapped={(name) =>
                onFixUnmapped
                  ? onFixUnmapped(chainClientId, name)
                  : router.push(
                      `/finance?tab=chainSplit&chainClientId=${chainClientId}&name=${encodeURIComponent(name)}`
                    )
              }
            />
          )}

          {created.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-success/40 bg-success-light/30 p-4">
              <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle2 className="size-4" />
                {t("createdTitle", { count: created.length })}
              </span>
              {created.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono">{inv.number}</span>
                    <span className="text-muted-foreground"> · {inv.clientName}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{formatTiyin(inv.totalTiyin, locale)}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={t("pdf")} onClick={() => void openPdf(inv.id, () => toast.error(t("pdfError")))}>
                      <FileText className="size-4" />
                    </Button>
                  </span>
                </div>
              ))}
              <Link href="/finance?tab=invoices" className="mt-1 flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline">
                {t("goToInvoices")}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PreviewPanel({
  preview,
  locale,
  canManage,
  issuing,
  issuedIds,
  onIssue,
  onFixUnmapped,
}: {
  preview: ChainInvoicePreview;
  locale: string;
  canManage: boolean;
  issuing: string | null;
  issuedIds: Set<string>;
  onIssue: (legalEntityId?: string) => void;
  onFixUnmapped: (name: string) => void;
}) {
  const t = useTranslations("ChainInvoices");
  const billable = preview.groups.filter((g) => g.legalEntityId && g.issuable);
  const baskets = preview.groups.filter((g) => !g.legalEntityId);
  const hasAttention = preview.unmappedProducts.length > 0 || preview.unlinkedClientIds.length > 0;
  const pending = billable.filter((g) => !issuedIds.has(g.legalEntityId!));

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{t("previewTitle", { chain: preview.chainName, period: preview.period })}</h3>
        <span className="text-sm text-muted-foreground">
          {t("rate", { rate: preview.rate.toLocaleString(locale) })} ·{" "}
          <span className="font-semibold text-foreground tabular-nums">{formatTiyin(preview.totalUzsTiyin, locale)}</span>
        </span>
      </div>

      {hasAttention && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-light/40 p-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-warning">
            <TriangleAlert className="size-4" />
            {t("attention")}
          </span>
          {preview.unmappedProducts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{t("unmapped")}:</span>
              {preview.unmappedProducts.map((name) => (
                <button key={name} type="button" onClick={() => onFixUnmapped(name)} className="rounded bg-secondary px-1.5 py-0.5 font-medium underline-offset-2 hover:underline">
                  {name}
                </button>
              ))}
            </div>
          )}
          {preview.unlinkedClientIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{t("unlinked")}:</span>
              {preview.unlinkedClientIds.map((id) => (
                <span key={id} className="rounded bg-secondary px-1.5 py-0.5 font-mono">{id}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {preview.groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("previewEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {billable.map((g) => (
            <PreviewGroup
              key={`b${g.legalEntityId}`}
              group={g}
              rate={preview.rate}
              locale={locale}
              tone="ok"
              canManage={canManage}
              issued={issuedIds.has(g.legalEntityId!)}
              issuing={issuing === g.legalEntityId}
              onIssue={() => onIssue(g.legalEntityId!)}
            />
          ))}
          {baskets.map((g, i) => (
            <PreviewGroup key={`x${i}`} group={g} rate={preview.rate} locale={locale} tone="basket" canManage={canManage} />
          ))}
        </div>
      )}

      {canManage && pending.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">{t("groupsSummary", { billable: billable.length, baskets: baskets.length })}</span>
          <Button onClick={() => onIssue()} disabled={issuing !== null} className="gap-2">
            {issuing === "all" ? <Spinner className="size-4" /> : <Send className="size-4" />}
            {t("issueAll")}
          </Button>
        </div>
      )}
    </div>
  );
}

function PreviewGroup({
  group,
  rate,
  locale,
  tone,
  canManage,
  issued,
  issuing,
  onIssue,
}: {
  group: ChainInvoicePreview["groups"][number];
  rate: number;
  locale: string;
  tone: "ok" | "basket";
  canManage: boolean;
  issued?: boolean;
  issuing?: boolean;
  onIssue?: () => void;
}) {
  const t = useTranslations("ChainInvoices");
  return (
    <div className={tone === "basket" ? "rounded-lg border border-warning/40 bg-warning-light/20 p-3" : "rounded-lg border border-border p-3"}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          {group.legalEntityName || t(`flags.${group.reason || "unmapped"}`)}
          {tone === "basket" && group.reason && (
            <Badge variant="secondary" className="bg-warning-light text-warning">{t(`flags.${group.reason}`)}</Badge>
          )}
          {issued && (
            <Badge variant="secondary" className="bg-success-light text-success">{t("issuedBadge")}</Badge>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">{formatTiyin(group.totalUzsTiyin, locale)}</span>
          {tone === "ok" && canManage && onIssue && !issued && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5" disabled={issuing} onClick={onIssue}>
              {issuing ? <Spinner className="size-3.5" /> : <Send className="size-3.5" />}
              {t("issueOne")}
            </Button>
          )}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {group.lines.map((line, i) => (
          <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-sm">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="font-medium">{line.venueName}</span>
              <span className="text-muted-foreground">· {line.product} ×{line.qty}</span>
              {line.flags.map((f) => (
                <Badge key={f} variant="secondary" className="bg-secondary text-[0.65rem] text-muted-foreground">{t(`flags.${f}`)}</Badge>
              ))}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatTiyin(minorToTiyin(line.amountMinor, rate), locale)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
