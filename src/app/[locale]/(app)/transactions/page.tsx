import { RouteRedirect } from "@/components/common/route-redirect";

/** Транзакции переехали в хаб «Финансы» */
export default function RedirectPage() {
  return <RouteRedirect to="/finance?tab=transactions" />;
}
