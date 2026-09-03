"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTable } from "@/components/admin/users/users-table";
import { RolesList } from "@/components/admin/roles/roles-list";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Хаб «Пользователи»: Люди · Роли и доступы */
export default function AdminUsersPage() {
  const t = useTranslations("AdminUsers");
  const { can, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = [
    { key: "people", visible: can(PERMISSIONS.usersList) },
    { key: "roles", visible: can(PERMISSIONS.rolesRead) },
  ].filter((tab) => tab.visible);

  if (loading) return null;
  if (tabs.length === 0) return <NoAccess />;

  const requested = searchParams.get("tab") ?? "";
  const active = tabs.some((tab) => tab.key === requested) ? requested : tabs[0].key;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("hubTitle")} description={t("hubDescription")} />
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
        <TabsContent value="people">
          <UsersTable />
        </TabsContent>
        <TabsContent value="roles">
          <RolesList embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
