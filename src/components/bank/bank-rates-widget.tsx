"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleDollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { BankRates } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const SHOWN_CODES = ["USD", "EUR", "RUB"];

/** У банка буквенный код лежит в `kod`, а `char_kod` — числовой ISO */
function letterCode(rate: { kod?: string; char_kod?: string }): string {
  if (rate.kod && /^[A-Z]{3}$/.test(rate.kod)) return rate.kod;
  if (rate.char_kod && /^[A-Z]{3}$/.test(rate.char_kod)) return rate.char_kod;
  return rate.kod ?? rate.char_kod ?? "";
}

function Change({ value }: { value?: string }) {
  const num = Number(value);
  if (!value || !Number.isFinite(num) || num === 0) return null;
  const up = num > 0;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs tabular-nums",
        up ? "text-success" : "text-destructive"
      )}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(num).toLocaleString("ru-RU")}
    </span>
  );
}

/** Курсы валют Капиталбанка (виджет Дашборда, право bank.view) */
export function BankRatesWidget() {
  const t = useTranslations("Bank.rates");
  const { can, loading } = useCurrentUser();
  const canView = can(PERMISSIONS.bankView);

  const [rates, setRates] = useState<BankRates | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canView) return;
    bankApi
      .rates()
      .then(setRates)
      .catch(() => setFailed(true));
  }, [canView]);

  if (loading || !canView || failed) return null;

  const shown = rates
    ? rates.courses.filter((c) => SHOWN_CODES.includes(letterCode(c)))
    : [];

  return (
    <Card className="h-full w-full gap-3 rounded-lg p-5 duration-450 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2">
        <CircleDollarSign className="size-4.5 text-primary" strokeWidth={1.75} />
        <h3 className="font-semibold">{t("title")}</h3>
        {rates?.stale && (
          <span className="text-xs text-warning">{t("stale")}</span>
        )}
        {rates?.date && (
          <span className="ms-auto text-xs text-muted-foreground tabular-nums">
            {rates.date}
          </span>
        )}
      </div>

      {!rates ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 rounded-md" />
          <Skeleton className="h-8 rounded-md" />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[3rem_1fr_1fr_1fr] gap-2 text-xs text-muted-foreground">
            <span />
            <span className="text-right">{t("cb")}</span>
            <span className="text-right">{t("buy")}</span>
            <span className="text-right">{t("sell")}</span>
          </div>
          {shown.map((rate) => (
            <div
              key={letterCode(rate)}
              className="grid grid-cols-[3rem_1fr_1fr_1fr] items-center gap-2 rounded-md py-1.5 text-sm"
            >
              <span className="font-semibold">{letterCode(rate)}</span>
              <span className="flex flex-col items-end">
                <span className="tabular-nums">
                  {Number(rate.course_cb).toLocaleString("ru-RU")}
                </span>
                <Change value={rate.change_cb} />
              </span>
              <span className="flex flex-col items-end">
                <span className="tabular-nums">
                  {Number(rate.course_buy).toLocaleString("ru-RU")}
                </span>
                <Change value={rate.change_buy} />
              </span>
              <span className="flex flex-col items-end">
                <span className="tabular-nums">
                  {Number(rate.course_sell).toLocaleString("ru-RU")}
                </span>
                <Change value={rate.change_sell} />
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
