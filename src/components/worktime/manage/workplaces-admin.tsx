"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Crosshair, MapPin, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { type MarkingMethod, type Office } from "@/lib/api";
import { locationsApi, SessionExpiredError } from "@/lib/api-authed";
import { useRouter } from "@/i18n/navigation";

const METHODS: MarkingMethod[] = ["button", "geo", "qr"];

function methodStyle(method: MarkingMethod | undefined): string {
  switch (method) {
    case "geo":
      return "bg-accent-light text-primary";
    case "qr":
      return "bg-success-light text-success";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

/** Экран 5 — рабочие места: геозона, способ отметки и QR для печати */
export function WorkplacesAdmin() {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Office | null>(null);
  const [qr, setQr] = useState<{ office: Office; token: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOffices(await locationsApi.offices());
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        router.replace("/login");
        return;
      }
      toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("workplacesHint")}</p>

      {offices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-lg bg-accent-light">
              <MapPin className="size-6 text-primary" />
            </span>
            <p className="font-medium">{t("noWorkplaces")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {offices.map((office) => (
            <div
              key={office.id}
              className="flex flex-col gap-2 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{office.name}</p>
                  {office.address && (
                    <p className="truncate text-xs text-muted-foreground">
                      {office.address}
                    </p>
                  )}
                </div>
                <Badge className={methodStyle(office.markingMethod)}>
                  {t(`method.${office.markingMethod ?? "button"}`)}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {office.lat != null && office.lng != null && (
                  <span className="tabular-nums">
                    {office.lat.toFixed(5)}, {office.lng.toFixed(5)}
                  </span>
                )}
                {office.radiusMeters != null && (
                  <span>{t("radius")}: {office.radiusMeters}</span>
                )}
                {office.hasQr && (
                  <span className="inline-flex items-center gap-1 text-success">
                    <QrCode className="size-3" />
                    {t("qrReady")}
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(office)}
                >
                  {tc("edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      const { qrToken } = await locationsApi.generateQr(
                        office.id
                      );
                      setQr({ office, token: qrToken });
                      void load();
                    } catch (e) {
                      if (e instanceof SessionExpiredError)
                        router.replace("/login");
                      else toast.error(t("saveError"));
                    }
                  }}
                >
                  <QrCode className="size-4" />
                  {office.hasQr ? t("regenerateQr") : t("showQr")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <WorkplaceDialog
          office={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {qr && (
        <QrDialog
          office={qr.office}
          token={qr.token}
          onClose={() => setQr(null)}
        />
      )}
    </div>
  );
}

function WorkplaceDialog({
  office,
  onClose,
  onSaved,
}: {
  office: Office;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [address, setAddress] = useState(office.address ?? "");
  const [method, setMethod] = useState<MarkingMethod>(
    office.markingMethod ?? "button"
  );
  const [lat, setLat] = useState(office.lat != null ? String(office.lat) : "");
  const [lng, setLng] = useState(office.lng != null ? String(office.lng) : "");
  const [radius, setRadius] = useState(
    office.radiusMeters != null ? String(office.radiusMeters) : "150"
  );
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function save() {
    setSaving(true);
    try {
      await locationsApi.updateWorkplace(office.id, {
        address: address.trim() || undefined,
        markingMethod: method,
        lat: lat.trim() ? Number(lat) : null,
        lng: lng.trim() ? Number(lng) : null,
        radiusMeters: radius.trim() ? Number(radius) : undefined,
      });
      toast.success(t("workplaceSaved"));
      onSaved();
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(t("saveError"));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{office.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("address")}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("markingMethod")}</Label>
            <Select
              value={method}
              items={Object.fromEntries(
                METHODS.map((m) => [m, t(`method.${m}`)])
              )}
              onValueChange={(v) => setMethod((v ?? "button") as MarkingMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-44">
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`method.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {method === "geo" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("latitude")}</Label>
                  <Input
                    value={lat}
                    inputMode="decimal"
                    className="tabular-nums"
                    onChange={(e) => setLat(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("longitude")}</Label>
                  <Input
                    value={lng}
                    inputMode="decimal"
                    className="tabular-nums"
                    onChange={(e) => setLng(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 self-start"
                disabled={locating}
                onClick={useMyLocation}
              >
                {locating ? (
                  <Spinner className="size-4" />
                ) : (
                  <Crosshair className="size-4" />
                )}
                {t("useMyLocation")}
              </Button>
              <div className="flex flex-col gap-1.5">
                <Label>{t("radius")}</Label>
                <Input
                  value={radius}
                  inputMode="numeric"
                  className="tabular-nums"
                  onChange={(e) => setRadius(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  {t("geoHint")}
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QrDialog({
  office,
  token,
  onClose,
}: {
  office: Office;
  token: string;
  onClose: () => void;
}) {
  const t = useTranslations("Worktime");
  const tc = useTranslations("Common");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(token, { width: 240, margin: 2 })
      .then((url) => active && setDataUrl(url))
      .catch(() => active && setDataUrl(null));
    return () => {
      active = false;
    };
  }, [token]);

  function print() {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    w.document.write(
      `<html><head><title>${office.name}</title></head><body style="font-family:system-ui;text-align:center;padding:32px">` +
        `<h2 style="margin:0 0 4px">${office.name}</h2>` +
        `<p style="color:#666;margin:0 0 24px">VEDA SERVICE</p>` +
        `<img src="${dataUrl}" style="width:280px;height:280px" />` +
        `</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{office.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt="QR"
              width={240}
              height={240}
              className="rounded-lg border bg-white p-2"
            />
          ) : (
            <Skeleton className="size-[240px] rounded-lg" />
          )}
          <p className="text-center text-xs text-muted-foreground">
            {t("qrTokenOnce")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tc("close")}
          </Button>
          <Button className="gap-1.5" onClick={print}>
            <Printer className="size-4" />
            {t("printQr")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
