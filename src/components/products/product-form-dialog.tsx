"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Product, ProductCurrency, ProductType } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { productsApi } from "@/lib/api-authed";

const TYPES: ProductType[] = ["iikoSaaS", "iikoCloud", "other"];
const CURRENCIES: ProductCurrency[] = ["USD", "UZS"];

export function ProductFormDialog({
  open,
  product,
  usdRate,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null — создание */
  product: Product | null;
  usdRate: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Products.form");
  const tt = useTranslations("Products.types");

  const [name, setName] = useState("");
  const [type, setType] = useState<ProductType>("other");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState<ProductCurrency>("USD");
  const [description, setDescription] = useState("");
  const [spic, setSpic] = useState("");
  const [packageCode, setPackageCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс формы при открытии
    setName(product?.name ?? "");
    setType(product?.type ?? "other");
    setPrice(product ? String(product.price) : "0");
    setCurrency(product?.currency ?? "USD");
    setDescription(product?.description ?? "");
    setSpic(product?.spic ?? "");
    setPackageCode(product?.packageCode ?? "");
    setIsActive(product?.isActive ?? true);
    setError(null);
  }, [open, product]);

  const priceNumber = Number(price.replace(",", "."));
  const priceValid = Number.isFinite(priceNumber) && priceNumber >= 0;
  // Предпросмотр сумового эквивалента — сервер посчитает так же
  const previewUzs =
    priceValid && currency === "USD" ? Math.round(priceNumber * usdRate) : null;

  async function save() {
    if (!name.trim() || !priceValid) {
      setError(t("validation"));
      return;
    }
    if (spic && !/^\d{5,20}$/.test(spic)) {
      setError(t("spicInvalid"));
      return;
    }
    if (packageCode && !/^\d{1,20}$/.test(packageCode)) {
      setError(t("packageCodeInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      type,
      price: Math.round(priceNumber * 100) / 100,
      currency,
      description: description.trim(),
      spic: spic.trim(),
      packageCode: packageCode.trim(),
      isActive,
    };
    try {
      if (product) await productsApi.update(product.id, body);
      else await productsApi.create(body);
      toast.success(t("saved"));
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER1101") setError(t("duplicate"));
      else setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-name" className="text-sm font-medium text-muted-foreground">
              {t("name")}
            </Label>
            <Input
              id="p-name"
              value={name}
              maxLength={200}
              placeholder={t("namePlaceholder")}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("type")}
            </Label>
            <Select
              value={type}
              items={Object.fromEntries(TYPES.map((v) => [v, tt(v)]))}
              onValueChange={(v) => setType(v as ProductType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tt(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-price" className="text-sm font-medium text-muted-foreground">
              {t("price")}
            </Label>
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
              <Input
                id="p-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value.replace(/[^\d.,]/g, ""));
                  setError(null);
                }}
                className="tabular-nums"
              />
              <Select
                value={currency}
                items={Object.fromEntries(CURRENCIES.map((v) => [v, t(`currency.${v}`)]))}
                onValueChange={(v) => setCurrency(v as ProductCurrency)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`currency.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {previewUzs !== null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("uzsPreview", {
                  amount: previewUzs.toLocaleString("ru-RU"),
                  rate: usdRate.toLocaleString("ru-RU"),
                })}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-desc" className="text-sm font-medium text-muted-foreground">
              {t("description")}
            </Label>
            <Textarea
              id="p-desc"
              value={description}
              maxLength={2000}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-spic" className="text-sm font-medium text-muted-foreground">
                {t("spic")}
              </Label>
              <Input
                id="p-spic"
                inputMode="numeric"
                maxLength={20}
                value={spic}
                placeholder="10305001001000000"
                onChange={(e) => {
                  setSpic(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
                className="min-w-0 tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-package" className="text-sm font-medium text-muted-foreground">
                {t("packageCode")}
              </Label>
              <Input
                id="p-package"
                inputMode="numeric"
                maxLength={20}
                value={packageCode}
                placeholder="1495468"
                onChange={(e) => {
                  setPackageCode(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
                className="min-w-0 tabular-nums"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            {t("isActive")}
          </label>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
