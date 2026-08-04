import { getTranslations } from "next-intl/server";
import { Rocket } from "lucide-react";
import { AppFooter } from "@/components/common/app-footer";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center pb-16">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="duration-450 animate-in fade-in zoom-in-90">
          <div className="flex size-14 animate-pulse items-center justify-center rounded-lg bg-accent-light [animation-duration:2.5s]">
            <Rocket className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight duration-450 animate-in fade-in slide-in-from-bottom-4">
          {t("inDevelopment")}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground duration-450 animate-in fade-in slide-in-from-bottom-4 [animation-delay:120ms] [animation-fill-mode:backwards]">
          {t("comingSoon")}
        </p>
      </div>

      <AppFooter />
    </div>
  );
}
