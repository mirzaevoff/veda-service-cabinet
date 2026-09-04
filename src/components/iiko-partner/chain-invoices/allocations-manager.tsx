"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Layers, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Allocation, Venue } from "@/lib/api";
import { allocationsApi, venuesApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDelayed } from "@/hooks/use-delayed";
import { formatRelativeTime } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";

const ALL = "__all__";

export function AllocationsManager() {
  const t = useTranslations("Allocations");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.iikoInvoicesManage);

  const [chains, setChains] = useState<Venue[]>([]);
  const [scope, setScope] = useState(ALL);
  const [items, setItems] = useState<Allocation[] | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const showSkeleton = useDelayed(!items);

  useEffect(() => {
    void venuesApi.list({ kind: "chain", limit: 200, sort: "name" }).then((p) => setChains(p.items)).catch(() => {});
    void allocationsApi.syncStatus().then((s) => setLastSyncAt(s.lastSyncAt)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    allocationsApi
      .list(scope === ALL ? undefined : scope)
      .then(setItems)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else setItems([]);
      });
  }, [scope, router]);

  useEffect(() => load(), [load]);

  async function sync() {
    setSyncing(true);
    try {
      const r = await allocationsApi.sync(scope === ALL ? undefined : scope);
      toast.success(t("synced", { count: r.allocations ?? 0 }));
      void allocationsApi.syncStatus().then((s) => setLastSyncAt(s.lastSyncAt)).catch(() => {});
      load();
    } catch {
      toast.error(t("genericError"));
    } finally {
      setSyncing(false);
    }
  }

  const chainName = (id: string) => chains.find((c) => c.iikoClientId === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={scope}
          items={{ [ALL]: t("allChains"), ...Object.fromEntries(chains.map((c) => [c.iikoClientId, c.name])) }}
          onValueChange={(v) => setScope(v ?? ALL)}
        >
          <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allChains")}</SelectItem>
            {chains.map((c) => (
              <SelectItem key={c.id} value={c.iikoClientId}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ms-auto flex items-center gap-3">
          {lastSyncAt && (
            <span className="text-xs text-muted-foreground">
              {t("lastSync", { time: formatRelativeTime(lastSyncAt, locale) })}
            </span>
          )}
          {canManage && (
            <Button variant="outline" size="sm" className="gap-1.5" disabled={syncing} onClick={() => void sync()}>
              {syncing ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
              {t("sync")}
            </Button>
          )}
        </div>
      </div>

      {!items ? (
        <div className="flex flex-col gap-2">{showSkeleton && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <Layers className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <div key={a._id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.productName}</span>
                <Badge variant="secondary" className="uppercase">{a.kind}</Badge>
                <span className="font-mono text-xs text-muted-foreground">#{a.productPortalId}</span>
                {scope === ALL && (
                  <Badge variant="secondary" className="bg-accent-light text-primary">{chainName(a.chainClientId)}</Badge>
                )}
                <span className="ms-auto text-xs text-muted-foreground">{a.firmName}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.points.map((p) => (
                  <span key={p.crmId} className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs">
                    {p.name}
                    <span className="font-semibold tabular-nums text-primary">×{p.qty}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
