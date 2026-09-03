import { RouteRedirect } from "@/components/common/route-redirect";

/** API-токены переехали в хаб «Система» */
export default function RedirectPage() {
  return <RouteRedirect to="/admin/panel?tab=apiTokens" />;
}
