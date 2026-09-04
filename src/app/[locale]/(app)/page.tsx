import { AppFooter } from "@/components/common/app-footer";
import { DashboardBlocks } from "@/components/dashboard/dashboard-blocks";

export default function DashboardPage() {
  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-5 pb-24">
      <DashboardBlocks />
      <AppFooter />
    </div>
  );
}
