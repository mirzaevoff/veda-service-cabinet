"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LedgerFeed } from "@/components/balances/ledger-feed";
import { InvoicesList } from "@/components/invoices/invoices-list";
import { ChainSplitWorkshop } from "@/components/iiko-partner/chain-invoices/chain-split-workshop";
import { BankPanel } from "@/components/bank/bank-panel";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Хаб «Финансы»: Транзакции · Счета · Банк */
export default function FinancePage() {
  const t = useTranslations("Finance");
  const { can, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = [
    { key: "transactions", visible: can(PERMISSIONS.balancesView) },
    { key: "invoices", visible: can(PERMISSIONS.invoicesView) },
    { key: "chainSplit", visible: can(PERMISSIONS.iikoInvoicesView) },
    { key: "bank", visible: can(PERMISSIONS.bankView) },
  ].filter((tab) => tab.visible);

  if (loading) return null;
  if (tabs.length === 0) return <NoAccess />;

  const requested = searchParams.get("tab") ?? "";
  const active = tabs.some((tab) => tab.key === requested) ? requested : tabs[0].key;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs
        value={active}
        onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
        className="flex flex-col gap-5"
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {t(`tabs.${tab.key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="transactions">
          <LedgerFeed embedded />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesList />
        </TabsContent>
        <TabsContent value="chainSplit">
          <ChainSplitWorkshop />
        </TabsContent>
        <TabsContent value="bank">
          <BankPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
