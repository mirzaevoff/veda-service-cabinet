"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChainInvoices } from "./chain-invoices";
import { ProductMapManager } from "./product-map-manager";
import { AllocationsManager } from "./allocations-manager";

/**
 * Мастер «Дробление сетей» (Финансы → Счета). Внутренние сегменты — локальным
 * состоянием: Дробление · Справочник продуктов · Раскладка. Счета-результат
 * живут в разделе «Счета» (обычные Invoice).
 */
export function ChainSplitWorkshop() {
  const t = useTranslations("ChainSplit");
  const [view, setView] = useState("split");
  const [prefill, setPrefill] = useState<{ chainClientId: string; name: string } | null>(null);

  return (
    <Tabs value={view} onValueChange={setView} className="flex flex-col gap-5">
      <TabsList>
        <TabsTrigger value="split">{t("split")}</TabsTrigger>
        <TabsTrigger value="map">{t("map")}</TabsTrigger>
        <TabsTrigger value="alloc">{t("alloc")}</TabsTrigger>
      </TabsList>

      <TabsContent value="split">
        <ChainInvoices
          onFixUnmapped={(chainClientId, name) => {
            setPrefill({ chainClientId, name });
            setView("map");
          }}
        />
      </TabsContent>
      <TabsContent value="map">
        <ProductMapManager
          key={prefill ? `${prefill.chainClientId}:${prefill.name}` : "default"}
          initialChainId={prefill?.chainClientId}
          initialName={prefill?.name}
        />
      </TabsContent>
      <TabsContent value="alloc">
        <AllocationsManager />
      </TabsContent>
    </Tabs>
  );
}
