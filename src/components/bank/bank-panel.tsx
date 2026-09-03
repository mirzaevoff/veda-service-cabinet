"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BankTransactions } from "@/components/bank/bank-transactions";
import { BankAccounts } from "@/components/bank/bank-accounts";
import { BankReconciliations } from "@/components/bank/bank-reconciliations";
import type { BankAccount } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";

const TABS = ["transactions", "accounts", "reconciliations"] as const;

/** Банк Kapitalbank: транзакции, счета, сверка. Под-вкладки — локальным состоянием (вложен в хаб «Финансы») */
export function BankPanel() {
  const t = useTranslations("Bank");
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [active, setActive] = useState<string>("transactions");

  const reloadAccounts = useCallback(() => {
    bankApi.accounts
      .list()
      .then((page) => setAccounts(page.items))
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => reloadAccounts(), [reloadAccounts]);

  return (
    <Tabs value={active} onValueChange={setActive} className="flex flex-col gap-5">
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
  );
}
