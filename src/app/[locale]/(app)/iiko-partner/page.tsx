"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartnerProfile } from "@/components/iiko-partner/partner-profile";
import { IikoServers } from "@/components/iiko-partner/iiko-servers";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

const TABS = ["profile", "servers"] as const;

/** iiko Partner: профиль компании и мониторинг серверов клиентов */
export default function IikoPartnerPage() {
  const t = useTranslations("IikoPartner");
  const { can, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (loading) return null;
  if (!can(PERMISSIONS.iikoPartnerView)) return <NoAccess />;

  const requested = searchParams.get("tab") ?? "";
  const active = (TABS as readonly string[]).includes(requested)
    ? requested
    : "profile";

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

        <TabsContent value="profile">
          <PartnerProfile />
        </TabsContent>
        <TabsContent value="servers">
          <IikoServers />
        </TabsContent>
      </Tabs>
    </div>
  );
}
