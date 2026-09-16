"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { ScopePicker } from "@/components/checklists/scope-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { RunsList } from "@/components/checklists/runs-list";
import { TemplatesPanel } from "@/components/checklists/templates-panel";
import { SchedulesPanel } from "@/components/checklists/schedules-panel";
import { StatsPanel } from "@/components/checklists/stats-panel";
import { PositionsManager } from "@/components/checklists/positions-manager";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { ChecklistTemplate, LegalEntity, Position } from "@/lib/api";
import { checklistsApi, legalEntitiesApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";

export default function ChecklistsPage() {
  const t = useTranslations("Checklists");
  const { can } = useCurrentUser();
  const isStaffManager = can(PERMISSIONS.checklistsManage);

  /** Мои ЮЛ с деталями: members присутствуют только у owner'а (и staff) */
  const [entities, setEntities] = useState<LegalEntity[] | null>(null);
  const [scope, setScope] = useState<string>("personal");
  const [tab, setTab] = useState("runs");
  /** По умолчанию выбираем первое ЮЛ (а не «Личные») — один раз после загрузки */
  const didDefaultScope = useRef(false);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    // ТП (checklists.manage) управляет любыми ЮЛ — показываем весь справочник
    const source = isStaffManager
      ? legalEntitiesApi.list({ limit: 100, sort: "name:asc" }).then((p) => p.items)
      : legalEntitiesApi.my();
    source
      .then((items) =>
        Promise.all(
          items.map((entity) =>
            legalEntitiesApi.get(entity.id).catch(() => entity)
          )
        )
      )
      .then(setEntities)
      .catch(() => setEntities([]));
  }, [isStaffManager]);

  // Как только ЮЛ загрузились — выбираем первое ЮЛ по умолчанию (не «Личные»)
  useEffect(() => {
    if (didDefaultScope.current) return;
    if (entities && entities.length > 0) {
      didDefaultScope.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- одноразовый дефолт после загрузки
      setScope(entities[0].id);
    }
  }, [entities]);

  const current = useMemo(
    () => entities?.find((entity) => entity.id === scope) ?? null,
    [entities, scope]
  );
  const manage =
    scope === "personal" || isStaffManager || !!current?.members;

  const reloadScope = useCallback(() => {
    const entityParam = scope === "personal" ? undefined : scope;
    checklistsApi.templates
      .list({ entity: entityParam, limit: 50 })
      .then((page) => setTemplates(page.items.filter((tpl) => !tpl.archived)))
      .catch(() => setTemplates([]));
    if (entityParam) {
      checklistsApi.positions
        .list(entityParam)
        .then(setPositions)
        .catch(() => setPositions([]));
    } else {
      setPositions([]);
    }
  }, [scope]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс должностей при смене скоупа
  useEffect(reloadScope, [reloadScope]);

  const entityScope = scope !== "personal";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="runs">{t("tabRuns")}</TabsTrigger>
            <TabsTrigger value="templates">{t("tabTemplates")}</TabsTrigger>
            {manage && (
              <TabsTrigger value="schedules">{t("tabSchedules")}</TabsTrigger>
            )}
            {entityScope && manage && (
              <TabsTrigger value="stats">{t("tabStats")}</TabsTrigger>
            )}
          </TabsList>
          {/* Скоуп (ЮЛ) влияет только на шаблоны/расписания/статистику — на «Задания» скрываем, чтобы не путать */}
          {tab !== "runs" && (
            <ScopePicker
              value={scope}
              onChange={setScope}
              entities={entities ?? []}
              personalLabel={t("scopePersonal")}
            />
          )}
        </div>

        <TabsContent value="runs">
          <RunsList />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesPanel
            key={scope}
            entityId={entityScope ? scope : null}
            manage={manage}
          />
        </TabsContent>

        {manage && (
          <TabsContent value="schedules">
            <div className="flex flex-col gap-6">
              <SchedulesPanel
                key={scope}
                entityId={entityScope ? scope : null}
                templates={templates}
                positions={positions.filter((p) => !p.archived)}
                members={current?.members ?? []}
              />
              {entityScope && (
                <>
                  <Separator />
                  <PositionsManager
                    entityId={scope}
                    positions={positions.filter((p) => !p.archived)}
                    onChanged={reloadScope}
                  />
                </>
              )}
            </div>
          </TabsContent>
        )}

        {entityScope && manage && (
          <TabsContent value="stats">
            <StatsPanel key={scope} entityId={scope} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
