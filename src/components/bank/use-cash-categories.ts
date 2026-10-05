"use client";

import { useCallback, useEffect, useState } from "react";
import type { BankTransactionDirection, CashCategory } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";

/** Справочник статей (с архивными — чтобы старые операции показывали имя) */
export function useCashCategories() {
  const [categories, setCategories] = useState<CashCategory[] | null>(null);

  const reload = useCallback(() => {
    bankApi.categories
      .list(true)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => reload(), [reload]);

  return { categories, reload };
}

/** Статьи, которые можно поставить на операцию этого направления */
export function categoriesFor(
  categories: CashCategory[],
  direction: BankTransactionDirection
): CashCategory[] {
  return categories.filter(
    (c) => !c.archived && (c.direction === "both" || c.direction === direction)
  );
}
