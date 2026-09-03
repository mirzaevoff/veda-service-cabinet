import { RouteRedirect } from "@/components/common/route-redirect";

/** Банк переехал в хаб «Финансы» */
export default function RedirectPage() {
  return <RouteRedirect to="/finance?tab=bank" />;
}
