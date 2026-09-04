"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Play, RefreshCw, Store, TriangleAlert } from "lucide-react";
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
import type { ChainInvoice, ChainInvoicePreview, Venue } from "@/lib/api";
import {
  chainInvoicesApi,
  venuesApi,
  SessionExpiredError,
} from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { formatTiyin } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";
import { ChainInvoiceCard } from "./chain-invoice-card";
import { minorToTiyin } from "./chain-format";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ChainInvoices() {
  const t = useTranslations("ChainInvoices");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.iikoInvoicesManage);

  const [chains, setChains] = useState<Venue[]>([]);
  const [chainClientId, setChainClientId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());

  const [preview, setPreview] = useState<ChainInvoicePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [invoices, setInvoices] = useState<ChainInvoice[] | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void venuesApi
      .list({ kind: "chain", limit: 200, sort: "name" })
      .then((p) => setChains(p.items))
      .catch(() => {});
  }, []);

  const loadInvoices = useCallback(async () => {
    if (!chainClientId || !period) return;
    try {
      setInvoices(await chainInvoicesApi.list(chainClientId, period));
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainClientId, period]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- сброс при смене сети/периода */
    setPreview(null);
    setInvoices(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    void loadInvoices();
  }, [loadInvoices]);

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

  async function generateDrafts() {
    setGenerating(true);
    try {
      const saved = await chainInvoicesApi.generateDrafts(chainClientId, period);
      setInvoices(saved);
      setPreview(null);
      toast.success(t("draftsGenerated", { count: saved.length }));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Выбор сети и периода */}
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
                  <span className="flex items-center gap-2">
                    <Store className="size-3.5 text-muted-foreground" />
                    {c.name}
                  </span>
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
        <Button
          onClick={runPreview}
          disabled={!chainClientId || !period || previewing}
          className="gap-2"
        >
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
              generating={generating}
              onGenerate={generateDrafts}
              onFixUnmapped={(name) =>
                router.push(
                  `/iiko-partner?tab=productMap&chainClientId=${chainClientId}&name=${encodeURIComponent(name)}`
                )
              }
            />
          )}

          {/* Сохранённые счета */}
          {invoices && invoices.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {t("savedTitle", { period })}
                </h3>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void loadInvoices()}>
                  <RefreshCw className="size-3.5" />
                  {tc("refresh")}
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {invoices.map((inv) => (
                  <ChainInvoiceCard
                    key={inv._id}
                    invoice={inv}
                    canManage={canManage}
                    onChanged={loadInvoices}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Панель превью: требуют внимания + группы по ЮЛ */
function PreviewPanel({
  preview,
  locale,
  canManage,
  generating,
  onGenerate,
  onFixUnmapped,
}: {
  preview: ChainInvoicePreview;
  locale: string;
  canManage: boolean;
  generating: boolean;
  onGenerate: () => void;
  onFixUnmapped: (name: string) => void;
}) {
  const t = useTranslations("ChainInvoices");
  const billable = preview.groups.filter((g) => g.legalEntityId && g.issuable);
  const baskets = preview.groups.filter((g) => !g.legalEntityId);
  const hasAttention =
    preview.unmappedProducts.length > 0 || preview.unlinkedClientIds.length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {t("previewTitle", { chain: preview.chainName, period: preview.period })}
        </h3>
        <span className="text-sm text-muted-foreground">
          {t("rate", { rate: preview.rate.toLocaleString(locale) })} ·{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatTiyin(preview.totalUzsTiyin, locale)}
          </span>
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
                <button
                  key={name}
                  type="button"
                  onClick={() => onFixUnmapped(name)}
                  className="rounded bg-secondary px-1.5 py-0.5 font-medium underline-offset-2 hover:underline"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          {preview.unlinkedClientIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{t("unlinked")}:</span>
              {preview.unlinkedClientIds.map((id) => (
                <span key={id} className="rounded bg-secondary px-1.5 py-0.5 font-mono">
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {preview.groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("previewEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {billable.map((g, i) => (
            <PreviewGroup key={`b${i}`} group={g} rate={preview.rate} locale={locale} tone="ok" />
          ))}
          {baskets.map((g, i) => (
            <PreviewGroup key={`x${i}`} group={g} rate={preview.rate} locale={locale} tone="basket" />
          ))}
        </div>
      )}

      {canManage && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">
            {t("groupsSummary", { billable: billable.length, baskets: baskets.length })}
          </span>
          <Button onClick={onGenerate} disabled={generating || preview.groups.length === 0} className="gap-2">
            {generating ? <Spinner className="size-4" /> : <FileText className="size-4" />}
            {t("generateDrafts")}
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
}: {
  group: ChainInvoicePreview["groups"][number];
  rate: number;
  locale: string;
  tone: "ok" | "basket";
}) {
  const t = useTranslations("ChainInvoices");
  return (
    <div
      className={
        tone === "basket"
          ? "rounded-lg border border-warning/40 bg-warning-light/20 p-3"
          : "rounded-lg border border-border p-3"
      }
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {group.legalEntityName || t(`flags.${group.reason || "unmapped"}`)}
          {tone === "basket" && group.reason && (
            <Badge variant="secondary" className="ms-2 bg-warning-light text-warning">
              {t(`flags.${group.reason}`)}
            </Badge>
          )}
        </span>
        <span className="font-semibold tabular-nums">
          {formatTiyin(group.totalUzsTiyin, locale)}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {group.lines.map((line, i) => (
          <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-sm">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="font-medium">{line.venueName}</span>
              <span className="text-muted-foreground">· {line.product} ×{line.qty}</span>
              {line.flags.map((f) => (
                <Badge key={f} variant="secondary" className="bg-secondary text-[0.65rem] text-muted-foreground">
                  {t(`flags.${f}`)}
                </Badge>
              ))}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatTiyin(minorToTiyin(line.amountMinor, rate), locale)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
