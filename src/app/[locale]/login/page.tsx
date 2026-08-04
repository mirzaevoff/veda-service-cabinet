import { LoginFlow } from "@/components/auth/login-flow";
import { AppFooter } from "@/components/common/app-footer";
import { LocaleSwitcher } from "@/components/common/locale-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-10">
        <span className="font-brand text-base font-semibold text-primary">
          Veda Service
        </span>
        <LoginFlow />
      </div>

      <AppFooter />
    </main>
  );
}
