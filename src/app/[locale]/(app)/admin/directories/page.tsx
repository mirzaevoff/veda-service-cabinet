"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryTree } from "@/components/admin/categories/category-tree";
import { SeveritiesManager } from "@/components/admin/severities/severities-manager";
import { LocationsManager } from "@/components/admin/locations/locations-manager";
import { EquipmentDictsManager } from "@/components/admin/equipment-dicts/equipment-dicts-manager";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Справочники системы: горизонтальные табы по правам */
export default function AdminDirectoriesPage() {
  const t = useTranslations("AdminDirectories");
  const { can } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get("tab") ?? "";

  // Роли переехали на отдельную страницу — старые ссылки редиректим
  useEffect(() => {
    if (requested === "roles") router.replace("/admin/roles");
  }, [requested, router]);

  const tabs = [
    { key: "categories", visible: can(PERMISSIONS.ticketsCategoriesManage) },
    { key: "severities", visible: can(PERMISSIONS.ticketsCategoriesManage) },
    { key: "locations", visible: can(PERMISSIONS.locationsView) },
    { key: "equipmentDicts", visible: can(PERMISSIONS.equipmentView) },
  ].filter((tab) => tab.visible);

  if (tabs.length === 0) return <NoAccess />;
  const active = tabs.some((tab) => tab.key === requested)
    ? requested
    : tabs[0].key;

  return (
    <div className="mx-auto max-w-4xl">
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

        <TabsContent value="categories">
          <CategoryTree embedded />
        </TabsContent>
        <TabsContent value="severities">
          <SeveritiesManager embedded />
        </TabsContent>
        <TabsContent value="locations">
          <LocationsManager />
        </TabsContent>
        <TabsContent value="equipmentDicts">
          <EquipmentDictsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
