"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BankTransactions,
  CATEGORY_FILTER_SUPPORTED,
  type TransactionsPreset,
} from "@/components/bank/bank-transactions";
import { BankAccounts } from "@/components/bank/bank-accounts";
import { BankReconciliations } from "@/components/bank/bank-reconciliations";
import { BankCategories } from "@/components/bank/bank-categories";
import { CashFlowReport } from "@/components/bank/cash-flow-report";
import { useCashCategories } from "@/components/bank/use-cash-categories";
import type { BankAccount } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";

const TABS = ["transactions", "accounts", "report", "categories", "reconciliations"] as const;

/**
 * Банк: операции, счета (Капиталбанк + ручные + карты), отчёт по статьям,
 * справочник статей, сверка. Под-вкладки — локальным состоянием (вложен в хаб «Финансы»)
 */
export function BankPanel() {
  const t = useTranslations("Bank");
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [active, setActive] = useState<string>("transactions");
  const { categories, reload: reloadCategories } = useCashCategories();
  /** Сигнал «операции изменились» для списка транзакций */
  const [opsKey, setOpsKey] = useState(0);
  const [preset, setPreset] = useState<TransactionsPreset | null>(null);

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
        <BankTransactions
          accounts={accounts ?? []}
          categories={categories ?? []}
          reloadKey={opsKey}
          preset={preset}
          onBalancesChanged={reloadAccounts}
        />
      </TabsContent>
      <TabsContent value="accounts">
        <BankAccounts
          accounts={accounts}
          categories={categories ?? []}
          onChanged={reloadAccounts}
          onOperationsChanged={() => setOpsKey((k) => k + 1)}
        />
      </TabsContent>
      <TabsContent value="report">
        <CashFlowReport
          accounts={accounts ?? []}
          onDrillDown={
            CATEGORY_FILTER_SUPPORTED
              ? (target) => {
                  setPreset({
                    categoryId: target.categoryId ?? "none",
                    dateFrom: target.from,
                    dateTo: target.to,
                    account: target.accountId,
                    // как в отчёте: сторнированные в обороты не входят
                    voided: false,
                    nonce: Date.now(),
                  });
                  setActive("transactions");
                }
              : undefined
          }
        />
      </TabsContent>
      <TabsContent value="categories">
        <BankCategories categories={categories} onChanged={reloadCategories} />
      </TabsContent>
      <TabsContent value="reconciliations">
        <BankReconciliations accounts={accounts ?? []} />
      </TabsContent>
    </Tabs>
  );
}
