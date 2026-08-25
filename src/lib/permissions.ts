import type { UserProfile } from "./api";

export const PERMISSIONS = {
  ticketsList: "tickets.list",
  ticketsAnswer: "tickets.answer",
  ticketsManage: "tickets.manage",
  ticketsCategoriesManage: "tickets.categories.manage",
  usersList: "users.list",
  usersManage: "users.manage",
  rolesRead: "roles.read",
  rolesManage: "roles.manage",
  notificationsSend: "notifications.send",
  legalEntitiesList: "legalEntities.list",
  legalEntitiesManage: "legalEntities.manage",
  checklistsManage: "checklists.manage",
  settingsManage: "settings.manage",
  productsList: "products.list",
  productsManage: "products.manage",
  bankView: "bank.view",
  bankManage: "bank.manage",
  balancesView: "balances.view",
  balancesManage: "balances.manage",
  iikoPartnerView: "iikoPartner.view",
  iikoPartnerManage: "iikoPartner.manage",
  iikoServersView: "iikoServers.view",
  iikoServersManage: "iikoServers.manage",
  iikoInvoicesView: "iikoInvoices.view",
  iikoInvoicesManage: "iikoInvoices.manage",
  iikoPartnerInvoicesView: "iikoPartnerInvoices.view",
  iikoPartnerInvoicesManage: "iikoPartnerInvoices.manage",
  venuesView: "venues.view",
  venuesManage: "venues.manage",
  invoicesView: "invoices.view",
  invoicesManage: "invoices.manage",
} as const;

export function can(
  user: UserProfile | null | undefined,
  permission: string
): boolean {
  if (!user) return false;
  const permissions = user.role?.permissions ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
