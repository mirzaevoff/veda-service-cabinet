import { RouteRedirect } from "@/components/common/route-redirect";

/** Статистика переехала в хаб «Обращения» */
export default function RedirectPage() {
  return <RouteRedirect to="/tickets?tab=stats" />;
}
