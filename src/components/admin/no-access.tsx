"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";

export function NoAccess() {
  const t = useTranslations("Shell");

  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center duration-450 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
        <Lock className="size-[26px] text-primary" strokeWidth={1.75} />
      </div>
      <p className="text-sm text-muted-foreground">{t("noAccess")}</p>
    </div>
  );
}
