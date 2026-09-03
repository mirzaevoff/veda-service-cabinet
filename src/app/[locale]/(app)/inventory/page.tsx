import { RouteRedirect } from "@/components/common/route-redirect";

/** Инвентаризация переехала в хаб «Оборудование» */
export default function RedirectPage() {
  return <RouteRedirect to="/equipment?tab=inventory" />;
}
