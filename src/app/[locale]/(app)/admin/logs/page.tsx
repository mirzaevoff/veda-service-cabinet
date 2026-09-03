import { RouteRedirect } from "@/components/common/route-redirect";

/** Журнал действий переехал в хаб «Система» */
export default function RedirectPage() {
  return <RouteRedirect to="/admin/panel?tab=logs" />;
}
