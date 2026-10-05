"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ВРЕМЕННО: до исправления в API ночной аудит балансов (03:00) уводит
 * поступления с карт в нераспознанные платежи клиентов. Карты — «в обкатке».
 * Убрать: поставить false после выката фикса API (Д3 в balances-gap-report.md).
 */
export const CARDS_PILOT_WARNING = true;

export function CardsPilotNote({ className }: { className?: string }) {
  const t = useTranslations("Bank");
  if (!CARDS_PILOT_WARNING) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-light/40 p-3 text-sm",
        className
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-warning">{t("cardsPilot.title")}</span>
        <span className="text-muted-foreground">{t("cardsPilot.text")}</span>
      </div>
    </div>
  );
}
