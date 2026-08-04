import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFoundPage() {
  const t = await getTranslations("ErrorPages");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="duration-450 animate-in fade-in zoom-in-90">
        <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
          <Compass className="size-[26px] text-primary" strokeWidth={1.75} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4 [animation-delay:100ms] [animation-fill-mode:backwards]">
        <span className="font-brand text-5xl font-bold text-primary">404</span>
        <h1 className="text-xl font-bold tracking-tight">{t("notFoundTitle")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("notFoundText")}
        </p>
      </div>
      <Link
        href="/"
        className="duration-450 animate-in fade-in slide-in-from-bottom-4 [animation-delay:200ms] [animation-fill-mode:backwards]"
      >
        <Button className="h-12 px-8 font-semibold">{t("goHome")}</Button>
      </Link>
    </main>
  );
}
