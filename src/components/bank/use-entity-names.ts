"use client";

import { useEffect, useState } from "react";
import { legalEntitiesApi } from "@/lib/api-authed";

/** id ЮЛ → название (для подписи «чей кошелёк»); догружает недостающие */
export function useEntityNames(ids: (string | null | undefined)[]) {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = [...new Set(ids.filter((x): x is string => !!x))].sort().join(",");

  useEffect(() => {
    const missing = key ? key.split(",").filter((id) => !(id in names)) : [];
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        legalEntitiesApi
          .get(id)
          .then((e) => [id, e.name] as const)
          .catch(() => [id, ""] as const)
      )
    ).then((pairs) => {
      if (!cancelled) setNames((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ключ стабилизирует набор id
  }, [key]);

  return names;
}
