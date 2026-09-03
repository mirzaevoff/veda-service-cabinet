import { RouteRedirect } from "@/components/common/route-redirect";

/** Роли переехали в хаб «Пользователи» */
export default function RedirectPage() {
  return <RouteRedirect to="/admin/users?tab=roles" />;
}
