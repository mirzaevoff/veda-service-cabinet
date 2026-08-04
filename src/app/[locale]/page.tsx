import { getTranslations } from "next-intl/server";
import { AppFooter } from "@/components/common/app-footer";
import { LocaleSwitcher } from "@/components/common/locale-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { UserBar } from "@/components/common/user-bar";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
      {/* Мягкое фирменное свечение за вордмарком */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_50%_50%,var(--accent-light),transparent_70%)] opacity-50"
      />

      <div className="absolute right-4 top-4 flex items-center gap-2">
        <UserBar />
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative flex flex-col items-center gap-5 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.4em] text-muted-foreground">
          {t("eyebrow")}
        </span>
        <h1 className="font-brand text-4xl font-bold tracking-tight text-primary sm:text-6xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {t("tagline")}
        </p>
      </div>

      <AppFooter />
    </main>
  );
}
