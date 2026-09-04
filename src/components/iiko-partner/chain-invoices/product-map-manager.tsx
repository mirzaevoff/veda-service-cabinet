"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link2, Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { ProductMapEntry, Venue } from "@/lib/api";
import { productMapApi, venuesApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDelayed } from "@/hooks/use-delayed";
import { useRouter } from "@/i18n/navigation";

const GLOBAL = "__global__";

/** Префилл может прийти пропсами (из мастера) или из URL (?chainClientId=&name=) */
export function ProductMapManager({
  initialChainId,
  initialName,
}: {
  initialChainId?: string;
  initialName?: string;
} = {}) {
  const t = useTranslations("ProductMap");
  const tc = useTranslations("Common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.iikoInvoicesManage);

  const [chains, setChains] = useState<Venue[]>([]);
  const [scopeChainId, setScopeChainId] = useState(
    initialChainId ?? searchParams.get("chainClientId") ?? GLOBAL
  );
  const [entries, setEntries] = useState<ProductMapEntry[] | null>(null);
  const showSkeleton = useDelayed(!entries);

  // Форма
  const [invoiceProductName, setInvoiceProductName] = useState(
    initialName ?? searchParams.get("name") ?? ""
  );
  const [kind, setKind] = useState<"cloud" | "saas">("cloud");
  const [isNetwork, setIsNetwork] = useState(false);
  const [productPortalId, setProductPortalId] = useState("");
  const [productName, setProductName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ProductMapEntry | null>(null);

  useEffect(() => {
    void venuesApi
      .list({ kind: "chain", limit: 200, sort: "name" })
      .then((p) => setChains(p.items))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    productMapApi
      .list(scopeChainId === GLOBAL ? undefined : scopeChainId)
      .then(setEntries)
      .catch((e) => {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else setEntries([]);
      });
  }, [scopeChainId, router]);

  useEffect(() => load(), [load]);

  async function save() {
    if (!invoiceProductName.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!isNetwork && !productPortalId.trim()) {
      toast.error(t("portalIdRequired"));
      return;
    }
    setSaving(true);
    try {
      await productMapApi.upsert({
        chainClientId: scopeChainId === GLOBAL ? null : scopeChainId,
        invoiceProductName: invoiceProductName.trim(),
        kind,
        isNetwork,
        productPortalId: isNetwork ? undefined : productPortalId.trim(),
        productName: productName.trim() || undefined,
      });
      toast.success(t("saved"));
      setInvoiceProductName("");
      setProductPortalId("");
      setProductName("");
      setIsNetwork(false);
      load();
    } catch {
      toast.error(t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await productMapApi.remove(deleting._id);
      toast.success(t("deleted"));
      setDeleting(null);
      load();
    } catch {
      toast.error(t("genericError"));
    }
  }

  const chainName = (id: string) => chains.find((c) => c.iikoClientId === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{t("scope")}</Label>
        <Select
          value={scopeChainId}
          items={{ [GLOBAL]: t("scopeGlobal"), ...Object.fromEntries(chains.map((c) => [c.iikoClientId, c.name])) }}
          onValueChange={(v) => setScopeChainId(v ?? GLOBAL)}
        >
          <SelectTrigger className="h-9 w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GLOBAL}>{t("scopeGlobal")}</SelectItem>
            {chains.map((c) => (
              <SelectItem key={c.id} value={c.iikoClientId}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Форма добавления */}
      {canManage && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">{t("addTitle")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">{t("invoiceProductName")}</Label>
              <Input value={invoiceProductName} onChange={(e) => setInvoiceProductName(e.target.value)} placeholder={t("invoiceProductNamePlaceholder")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{t("kind")}</Label>
              <Select value={kind} items={{ cloud: "Cloud", saas: "SaaS" }} onValueChange={(v) => setKind((v ?? "cloud") as "cloud" | "saas")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloud">Cloud</SelectItem>
                  <SelectItem value="saas">SaaS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Switch checked={isNetwork} onCheckedChange={setIsNetwork} />
              {t("isNetwork")}
            </label>
            {!isNetwork && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">{t("productPortalId")}</Label>
                  <Input value={productPortalId} onChange={(e) => setProductPortalId(e.target.value)} placeholder="762956" className="tabular-nums" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">{t("productName")}</Label>
                  <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={t("productNamePlaceholder")} />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" disabled={saving} onClick={() => void save()}>
              {saving ? <Spinner className="size-4" /> : <Plus className="size-4" />}
              {t("add")}
            </Button>
          </div>
          {!isNetwork && (
            <p className="text-xs text-muted-foreground">{t("portalIdHint")}</p>
          )}
        </div>
      )}

      {/* Список */}
      {!entries ? (
        <div className="flex flex-col gap-2">{showSkeleton && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <Link2 className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <div key={e._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border p-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.invoiceProductName}</span>
                  <Badge variant="secondary" className="uppercase">{e.kind}</Badge>
                  {e.chainClientId ? (
                    <Badge variant="secondary" className="bg-accent-light text-primary">{chainName(e.chainClientId)}</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-secondary text-muted-foreground">{t("scopeGlobal")}</Badge>
                  )}
                  {e.isNetwork && <Badge variant="secondary" className="bg-secondary text-muted-foreground">{t("isNetwork")}</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {e.isNetwork ? t("networkNote") : (
                    <>
                      → {e.productName || "—"}{" "}
                      <span className="font-mono">{e.productPortalId && `#${e.productPortalId}`}</span>
                    </>
                  )}
                </span>
              </div>
              {canManage && (
                <Button variant="ghost" size="icon-sm" aria-label={tc("delete")} className="text-muted-foreground hover:text-destructive" onClick={() => setDeleting(e)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmText", { name: deleting?.invoiceProductName ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()} className="bg-destructive text-white hover:bg-destructive/90">{tc("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
