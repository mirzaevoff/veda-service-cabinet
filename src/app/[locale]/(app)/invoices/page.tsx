import { RouteRedirect } from "@/components/common/route-redirect";

/** Счета переехали в хаб «Финансы» */
export default function RedirectPage() {
  return <RouteRedirect to="/finance?tab=invoices" />;
}
