"use client";

import { useTranslations } from "next-intl";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPages");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light duration-450 animate-in fade-in zoom-in-90">
        <TriangleAlert className="size-[26px] text-primary" strokeWidth={1.75} />
      </div>
      <div className="flex flex-col items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4 [animation-delay:100ms] [animation-fill-mode:backwards]">
        <h1 className="text-xl font-bold tracking-tight">{t("errorTitle")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t("errorText")}</p>
      </div>
      <Button
        onClick={reset}
        className="h-12 gap-2 px-8 font-semibold duration-450 animate-in fade-in slide-in-from-bottom-4 [animation-delay:200ms] [animation-fill-mode:backwards]"
      >
        <RotateCcw className="size-4" />
        {t("retry")}
      </Button>
    </main>
  );
}
