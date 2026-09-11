"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoAccess } from "@/components/admin/no-access";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { MarkAttendance } from "@/components/worktime/mark-attendance";
import { MySchedule } from "@/components/worktime/my-schedule";
import { MySalary } from "@/components/worktime/my-salary";
import { MyTimesheet } from "@/components/worktime/my-timesheet";
import { TimesheetsAdmin } from "@/components/worktime/manage/timesheets-admin";
import { EmployeesAdmin } from "@/components/worktime/manage/employees-admin";
import { ShiftsAdmin } from "@/components/worktime/manage/shifts-admin";
import { WorkplacesAdmin } from "@/components/worktime/manage/workplaces-admin";
import { PayrollAdmin } from "@/components/worktime/payroll/payroll-admin";
import { LedgerAdmin } from "@/components/worktime/payroll/ledger-admin";
import { PERMISSIONS } from "@/lib/permissions";
import { usePathname, useRouter } from "@/i18n/navigation";

type AreaKey = "me" | "manage" | "payroll";

interface Leaf {
  key: string;
  area: AreaKey;
}

/**
 * Хаб «Рабочее время» — двухуровневый: область (Моё · Управление · Бухгалтерия)
 * по правам, внутри — вкладки-листья. `?tab=` хранит лист, область выводится
 * из него (deep-link из ⌘K продолжает работать).
 */
export default function WorktimePage() {
  const t = useTranslations("Worktime");
  const { can, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canView = can(PERMISSIONS.worktimeView);
  const canManage = can(PERMISSIONS.worktimeManage);
  const canPayroll = can(PERMISSIONS.payrollManage);

  const areaVisible: Record<AreaKey, boolean> = {
    me: canView,
    manage: canManage,
    payroll: canPayroll,
  };

  const allLeaves: Leaf[] = [
    { key: "mark", area: "me" },
    { key: "schedule", area: "me" },
    { key: "timesheet", area: "me" },
    { key: "salary", area: "me" },
    { key: "tsheets", area: "manage" },
    { key: "employees", area: "manage" },
    { key: "shifts", area: "manage" },
    { key: "workplaces", area: "manage" },
    { key: "payrollCalc", area: "payroll" },
    { key: "ledger", area: "payroll" },
  ];
  const leaves = allLeaves.filter((leaf) => areaVisible[leaf.area]);
  const areas = (["me", "manage", "payroll"] as AreaKey[]).filter(
    (a) => areaVisible[a]
  );

  if (loading) return null;
  if (leaves.length === 0) return <NoAccess />;

  const requested = searchParams.get("tab") ?? "";
  const activeLeaf =
    leaves.find((leaf) => leaf.key === requested) ?? leaves[0];
  const activeArea = activeLeaf.area;
  const areaLeaves = leaves.filter((leaf) => leaf.area === activeArea);

  const go = (tab: string) =>
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("hubTitle")} description={t("hubDescription")} />

      <div className="flex flex-col gap-4">
        {areas.length > 1 && (
          <Tabs
            value={activeArea}
            onValueChange={(area) => {
              const first = leaves.find((leaf) => leaf.area === area);
              if (first) go(first.key);
            }}
          >
            <TabsList>
              {areas.map((area) => (
                <TabsTrigger key={area} value={area}>
                  {t(`areas.${area}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <Tabs
          value={activeLeaf.key}
          onValueChange={go}
          className="flex flex-col gap-5"
        >
          {areaLeaves.length > 1 && (
            <TabsList>
              {areaLeaves.map((leaf) => (
                <TabsTrigger key={leaf.key} value={leaf.key}>
                  {t(`tabs.${leaf.key}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          <TabsContent value="mark">
            <MarkAttendance />
          </TabsContent>
          <TabsContent value="schedule">
            <MySchedule />
          </TabsContent>
          <TabsContent value="timesheet">
            <MyTimesheet />
          </TabsContent>
          <TabsContent value="salary">
            <MySalary />
          </TabsContent>
          <TabsContent value="tsheets">
            <TimesheetsAdmin />
          </TabsContent>
          <TabsContent value="employees">
            <EmployeesAdmin />
          </TabsContent>
          <TabsContent value="shifts">
            <ShiftsAdmin />
          </TabsContent>
          <TabsContent value="workplaces">
            <WorkplacesAdmin />
          </TabsContent>
          <TabsContent value="payrollCalc">
            <PayrollAdmin />
          </TabsContent>
          <TabsContent value="ledger">
            <LedgerAdmin />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
