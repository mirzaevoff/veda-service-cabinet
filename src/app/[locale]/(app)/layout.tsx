import { CurrentUserProvider } from "@/components/common/current-user-provider";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CurrentUserProvider>
      <div className="flex h-dvh overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="relative flex-1 overflow-y-auto p-4 [scrollbar-gutter:stable] sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </CurrentUserProvider>
  );
}
