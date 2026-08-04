import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/common/theme-toggle";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
      {/* Decorative background: subtle grid + soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black_30%,transparent_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
      />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative flex flex-col items-center gap-6 text-center">
        <span className="text-[0.7rem] font-light uppercase tracking-[0.45em] text-muted-foreground">
          {t("eyebrow")}
        </span>
        <h1 className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-7xl">
          {t("title")}
        </h1>
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
        <p className="text-sm font-extralight text-muted-foreground sm:text-base">
          {t("tagline")}
        </p>
      </div>
    </main>
  );
}
