"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartnerProfile } from "@/components/iiko-partner/partner-profile";
import { IikoInvoices } from "@/components/iiko-partner/iiko-invoices";
import { ChainInvoices } from "@/components/iiko-partner/chain-invoices/chain-invoices";
import { ProductMapManager } from "@/components/iiko-partner/chain-invoices/product-map-manager";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

/** iiko Partner: профиль, серверы клиентов и счета — табы по правам */
export default function IikoPartnerPage() {
  const t = useTranslations("IikoPartner");
  const { can, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canInvoices =
    can(PERMISSIONS.iikoInvoicesView) ||
    can(PERMISSIONS.iikoPartnerInvoicesView);

  const canChain = can(PERMISSIONS.iikoInvoicesView);

  const tabs = [
    { key: "profile", visible: can(PERMISSIONS.iikoPartnerView) },
    { key: "invoices", visible: canInvoices },
    { key: "chainInvoices", visible: canChain },
    { key: "productMap", visible: canChain },
  ].filter((tab) => tab.visible);

  if (loading) return null;
  if (tabs.length === 0) return <NoAccess />;

  const requested = searchParams.get("tab") ?? "";
  const active = tabs.some((tab) => tab.key === requested)
    ? requested
    : tabs[0].key;

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
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {t(`tabs.${tab.key}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.some((tab) => tab.key === "profile") && (
          <TabsContent value="profile">
            <PartnerProfile />
          </TabsContent>
        )}
        {canInvoices && (
          <TabsContent value="invoices">
            <IikoInvoices />
          </TabsContent>
        )}
        {canChain && (
          <TabsContent value="chainInvoices">
            <ChainInvoices />
          </TabsContent>
        )}
        {canChain && (
          <TabsContent value="productMap">
            <ProductMapManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
