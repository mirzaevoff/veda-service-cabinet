"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BankTransactions } from "@/components/bank/bank-transactions";
import { BankAccounts } from "@/components/bank/bank-accounts";
import { BankReconciliations } from "@/components/bank/bank-reconciliations";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { BankAccount } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

const TABS = ["transactions", "accounts", "reconciliations"] as const;

/** Банковские транзакции Kapitalbank: зеркало выписок, счета, сверка */
export default function AdminBankPage() {
  const t = useTranslations("Bank");
  const { can, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);

  const reloadAccounts = useCallback(() => {
    bankApi.accounts
      .list()
      .then((page) => setAccounts(page.items))
      .catch(() => setAccounts([]));
  }, []);

  const canView = can(PERMISSIONS.bankView);

  useEffect(() => {
    if (canView) reloadAccounts();
  }, [canView, reloadAccounts]);

  if (loading) return null;
  if (!canView) return <NoAccess />;

  const requested = searchParams.get("tab") ?? "";
  const active = (TABS as readonly string[]).includes(requested)
    ? requested
    : "transactions";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs
        value={active}
        onValueChange={(v) =>
          router.replace(`${pathname}?tab=${v}`, { scroll: false })
        }
        className="flex flex-col gap-5"
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="transactions">
          <BankTransactions accounts={accounts ?? []} />
        </TabsContent>
        <TabsContent value="accounts">
          <BankAccounts accounts={accounts} onChanged={reloadAccounts} />
        </TabsContent>
        <TabsContent value="reconciliations">
          <BankReconciliations accounts={accounts ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
