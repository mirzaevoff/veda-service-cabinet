import { AppFooter } from "@/components/common/app-footer";
import { BankRatesWidget } from "@/components/bank/bank-rates-widget";
import { DashboardBlocks } from "@/components/dashboard/dashboard-blocks";

export default function DashboardPage() {
  return (
    <div className="relative flex min-h-full flex-col items-center gap-5 pb-24">
      {/* Виджет курсов сам скрывается без права bank.view */}
      <div className="flex w-full justify-center pt-2">
        <BankRatesWidget />
      </div>

      <DashboardBlocks />

      <AppFooter />
    </div>
  );
}
