import {
  ApiError,
  request,
  type AccessRequest,
  type AccessRequestStatus,
  type AuthSession,
  type Bank,
  type BankAccount,
  type BankRates,
  type BankReconciliation,
  type BankReconciliationStatus,
  type BankTransaction,
  type BankTransactionDirection,
  type ChecklistItemInput,
  type ChecklistRun,
  type ChecklistRunStatus,
  type ChecklistSchedule,
  type ChecklistStats,
  type ChecklistTemplate,
  type EntityInvite,
  type IikoPartnerHealth,
  type IikoPartnerProfile,
  type IikoServerEvent,
  type IikoServersList,
  type IikoServersSyncResult,
  type Venue,
  type VenuesList,
  type VenuesSyncResult,
  type EntityMemberRole,
  type LegalEntity,
  type LegalEntityLookup,
  type Position,
  type NotificationsPage,
  type Page,
  type PermissionDef,
  type Product,
  type ProductCurrency,
  type ProductType,
  type ProductsPage,
  type Setting,
  type Role,
  type Ticket,
  type TicketCategory,
  type TicketMessage,
  type TicketSeverity,
  type TicketStatus,
  type UserProfile,
} from "./api";
import {
  clearSession,
  getAccessToken,
  getSessionId,
  refreshSession,
} from "./auth";

/** Сессия невосстановима — страницы ловят и уводят на /login */
export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

/**
 * Авторизованный запрос: Bearer из cookie; на 401 — один общий refresh
 * (single-flight в auth.ts) и повтор с новым токеном.
 */
export async function authedRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const attempt = () => {
    const token = getAccessToken();
    if (!token) throw new SessionExpiredError();
    return request<T>(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
  };

  try {
    return await attempt();
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    try {
      await refreshSession();
    } catch {
      clearSession();
      throw new SessionExpiredError();
    }
    return attempt();
  }
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export interface TicketListParams {
  page?: number;
  limit?: number;
  /** Смарт-поиск: тема обращения и автор (имя/телефон) */
  search?: string;
  status?: TicketStatus;
  categoryId?: string;
  legalEntityId?: string;
  all?: boolean;
  /** Staff: фильтр по важности */
  severityId?: string;
  /** Staff: только просроченные (красные) */
  breached?: boolean;
  /** Staff: только невзятые */
  unclaimed?: boolean;
  /** Например deadline:asc — красные сверху, exempt в конце */
  sort?: string;
}

export const ticketsApi = {
  list: (params: TicketListParams = {}) =>
    authedRequest<Page<Ticket>>(`/tickets${query({ ...params })}`),

  get: (id: string) => authedRequest<Ticket>(`/tickets/${id}`),

  create: (body: {
    subject: string;
    categoryId: string;
    subcategoryId?: string;
    legalEntityId?: string;
    text?: string;
    attachmentIds?: string[];
  }) =>
    authedRequest<Ticket>("/tickets", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: { status?: TicketStatus; assigneeId?: string }) =>
    authedRequest<Ticket>(`/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  rate: (id: string, body: { rating: number; review?: string }) =>
    authedRequest<Ticket>(`/tickets/${id}/rating`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Взять тикет в работу (суппорт входит в чат) */
  claim: (id: string) =>
    authedRequest<Ticket>(`/tickets/${id}/claim`, { method: "POST" }),

  /** Выйти из тикета (передача смене) */
  unclaim: (id: string) =>
    authedRequest<Ticket>(`/tickets/${id}/claim`, { method: "DELETE" }),

  setSeverity: (id: string, severityId: string) =>
    authedRequest<Ticket>(`/tickets/${id}/severity`, {
      method: "PATCH",
      body: JSON.stringify({ severityId }),
    }),

  messages: (id: string, params: { page?: number; limit?: number } = {}) =>
    authedRequest<Page<TicketMessage>>(
      `/tickets/${id}/messages${query({ ...params })}`
    ),

  sendMessage: (id: string, body: { text?: string; attachmentIds?: string[] }) =>
    authedRequest<TicketMessage>(`/tickets/${id}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  categories: () => authedRequest<TicketCategory[]>("/ticket-categories"),

  markRead: (id: string) =>
    authedRequest<void>(`/tickets/${id}/read`, { method: "POST" }),

  unreadCount: () =>
    authedRequest<{ total: number }>("/tickets/unread-count"),
};

export const usersApi = {
  me: () => authedRequest<UserProfile>("/users/me"),
  updateMe: (body: {
    name?: string;
    lastName?: string;
    birthDate?: string | null;
  }) =>
    authedRequest<UserProfile>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export const profileApi = {
  changePhone: (phone: string) =>
    authedRequest<{ phone: string; expiresIn: number; resendIn: number }>(
      "/auth/change-phone",
      { method: "POST", body: JSON.stringify({ phone }) }
    ),
  changePhoneVerify: (phone: string, code: string) =>
    authedRequest<UserProfile>("/auth/change-phone/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
  sessions: () =>
    authedRequest<AuthSession[]>(
      `/auth/sessions${query({ current: getSessionId() })}`
    ),
  terminateSession: (id: string) =>
    authedRequest<void>(`/auth/sessions/${id}`, { method: "DELETE" }),
  logoutAll: () =>
    authedRequest<void>("/auth/logout-all", { method: "POST" }),
  deleteAccount: () =>
    authedRequest<{ phone: string; expiresIn: number; resendIn: number }>(
      "/auth/delete-account",
      { method: "POST" }
    ),
  deleteAccountVerify: (code: string) =>
    authedRequest<void>("/auth/delete-account/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
};

export const notificationsApi = {
  list: (params: { page?: number; limit?: number } = {}) =>
    authedRequest<NotificationsPage>(`/notifications${query({ ...params })}`),
  read: (id: string) =>
    authedRequest<void>(`/notifications/${id}/read`, { method: "POST" }),
  readAll: () =>
    authedRequest<void>("/notifications/read-all", { method: "POST" }),
  send: (body: {
    userIds?: string[];
    broadcast?: boolean;
    text?: string;
    imageUrl?: string;
    button?: { text: string; url: string };
    pushTitle?: string;
  }) =>
    authedRequest<void>("/notifications/send", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const legalEntitiesApi = {
  list: (params: { page?: number; limit?: number; search?: string; sort?: string } = {}) =>
    authedRequest<Page<LegalEntity>>(`/legal-entities${query({ ...params })}`),
  my: () =>
    authedRequest<Page<LegalEntity>>("/legal-entities/my").then(
      (page) => page.items
    ),
  get: (id: string) => authedRequest<LegalEntity>(`/legal-entities/${id}`),
  lookup: (taxId: string) =>
    authedRequest<LegalEntityLookup>(`/legal-entities/lookup/${taxId}`),
  create: (body: {
    taxId: string;
    name: string;
    rawName?: string;
    establishment?: string;
    bankCode?: string;
    bank?: string;
    bankAccount?: string;
    address?: string;
    director?: { firstName: string; lastName: string; middleName: string } | null;
    registrationDate?: string | null;
  }) =>
    authedRequest<LegalEntity>("/legal-entities", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: Partial<{
      name: string;
      rawName: string;
      establishment: string;
      bankCode: string;
      bank: string;
      bankAccount: string;
      address: string;
      director: { firstName: string; lastName: string; middleName: string } | null;
      registrationDate: string | null;
    }>
  ) =>
    authedRequest<LegalEntity>(`/legal-entities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    authedRequest<void>(`/legal-entities/${id}`, { method: "DELETE" }),
  grantAccess: (id: string, userId: string, role?: EntityMemberRole) =>
    authedRequest<LegalEntity>(`/legal-entities/${id}/users`, {
      method: "POST",
      body: JSON.stringify({ userId, role }),
    }),
  updateMemberRole: (id: string, userId: string, role: EntityMemberRole) =>
    authedRequest<LegalEntity>(`/legal-entities/${id}/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  revokeAccess: (id: string, userId: string) =>
    authedRequest<void>(`/legal-entities/${id}/users/${userId}`, {
      method: "DELETE",
    }),
  invites: (id: string) =>
    authedRequest<EntityInvite[]>(`/legal-entities/${id}/invites`),
  invite: (id: string, body: { phone: string; role?: EntityMemberRole }) =>
    authedRequest<{ result: "added" | "invited" }>(
      `/legal-entities/${id}/invites`,
      { method: "POST", body: JSON.stringify(body) }
    ),
  revokeInvite: (id: string, inviteId: string) =>
    authedRequest<void>(`/legal-entities/${id}/invites/${inviteId}`, {
      method: "DELETE",
    }),
};

export const checklistsApi = {
  positions: {
    list: (entityId: string) =>
      authedRequest<Position[]>(`/legal-entities/${entityId}/positions`),
    create: (entityId: string, title: string) =>
      authedRequest<Position>(`/legal-entities/${entityId}/positions`, {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    update: (id: string, title: string) =>
      authedRequest<Position>(`/positions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    archive: (id: string) =>
      authedRequest<void>(`/positions/${id}`, { method: "DELETE" }),
    setMemberPositions: (entityId: string, userId: string, positions: string[]) =>
      authedRequest<void>(
        `/legal-entities/${entityId}/members/${userId}/positions`,
        { method: "PUT", body: JSON.stringify({ positions }) }
      ),
  },

  templates: {
    list: (
      params: {
        entity?: string;
        page?: number;
        limit?: number;
        sort?: string;
      } = {}
    ) =>
      authedRequest<Page<ChecklistTemplate>>(
        `/checklist-templates${query({ ...params })}`
      ),
    get: (id: string) =>
      authedRequest<ChecklistTemplate>(`/checklist-templates/${id}`),
    create: (body: {
      entityId?: string;
      name: string;
      description?: string;
      items: ChecklistItemInput[];
      photoFreshnessMinutes?: number | null;
    }) =>
      authedRequest<ChecklistTemplate>("/checklist-templates", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (
      id: string,
      body: Partial<{
        name: string;
        description: string;
        items: ChecklistItemInput[];
        photoFreshnessMinutes: number | null;
      }>
    ) =>
      authedRequest<ChecklistTemplate>(`/checklist-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    archive: (id: string) =>
      authedRequest<void>(`/checklist-templates/${id}`, { method: "DELETE" }),
  },

  schedules: {
    list: (
      params: {
        entity?: string;
        template?: string;
        page?: number;
        limit?: number;
        sort?: string;
      } = {}
    ) =>
      authedRequest<Page<ChecklistSchedule>>(
        `/checklist-schedules${query({ ...params })}`
      ),
    create: (body: {
      templateId: string;
      daysOfWeek: number[];
      times: string[];
      windowMinutes: number;
      allowLateCompletion?: boolean;
      assigneeUsers?: string[];
      assigneePositions?: string[];
      enabled?: boolean;
    }) =>
      authedRequest<ChecklistSchedule>("/checklist-schedules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (
      id: string,
      body: Partial<{
        daysOfWeek: number[];
        times: string[];
        windowMinutes: number;
        allowLateCompletion: boolean;
        assigneeUsers: string[];
        assigneePositions: string[];
        enabled: boolean;
      }>
    ) =>
      authedRequest<ChecklistSchedule>(`/checklist-schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (id: string) =>
      authedRequest<void>(`/checklist-schedules/${id}`, { method: "DELETE" }),
  },

  runs: {
    list: (
      params: {
        entity?: string;
        user?: string;
        template?: string;
        status?: ChecklistRunStatus;
        from?: string;
        to?: string;
        page?: number;
        limit?: number;
        sort?: string;
      } = {}
    ) => authedRequest<Page<ChecklistRun>>(`/checklist-runs${query({ ...params })}`),
    get: (id: string) => authedRequest<ChecklistRun>(`/checklist-runs/${id}`),
    createManual: (templateId: string) =>
      authedRequest<ChecklistRun>("/checklist-runs", {
        method: "POST",
        body: JSON.stringify({ templateId }),
      }),
    saveAnswers: (
      id: string,
      answers: {
        item: string;
        value?: boolean | string | number;
        photos?: string[];
        comment?: string;
      }[]
    ) =>
      authedRequest<ChecklistRun>(`/checklist-runs/${id}/answers`, {
        method: "PATCH",
        body: JSON.stringify({ answers }),
      }),
    complete: (id: string) =>
      authedRequest<ChecklistRun>(`/checklist-runs/${id}/complete`, {
        method: "POST",
      }),
  },

  stats: (entityId: string, params: { from?: string; to?: string } = {}) =>
    authedRequest<ChecklistStats>(
      `/legal-entities/${entityId}/checklist-stats${query({ ...params })}`
    ),
};

export const accessRequestsApi = {
  create: (body: { taxId: string; comment?: string }) =>
    authedRequest<AccessRequest>("/access-requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  my: (params: { page?: number; limit?: number; status?: AccessRequestStatus } = {}) =>
    authedRequest<Page<AccessRequest>>(
      `/access-requests/my${query({ ...params })}`
    ),
  cancel: (id: string) =>
    authedRequest<void>(`/access-requests/${id}`, { method: "DELETE" }),
  /** Входящие: owner — свои ЮЛ, ТП — все (+unassigned для неизвестных ИНН) */
  incoming: (
    params: {
      page?: number;
      limit?: number;
      status?: AccessRequestStatus;
      unassigned?: boolean;
    } = {}
  ) => authedRequest<Page<AccessRequest>>(`/access-requests${query({ ...params })}`),
  approve: (id: string, role?: EntityMemberRole) =>
    authedRequest<AccessRequest>(`/access-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(role ? { role } : {}),
    }),
  reject: (id: string, reason?: string) =>
    authedRequest<AccessRequest>(`/access-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    }),
};

export interface AdminUsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "blocked";
  roleId?: string;
  /** createdAt | name | lastName | phone | status */
  sort?: string;
}

export const adminApi = {
  users: {
    list: (params: AdminUsersListParams = {}) =>
      authedRequest<Page<UserProfile>>(`/users${query({ ...params })}`),
    get: (id: string) => authedRequest<UserProfile>(`/users/${id}`),
    update: (
      id: string,
      body: { status?: "active" | "blocked"; roleId?: string }
    ) =>
      authedRequest<UserProfile>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  roles: {
    /** С 0.8.0 — страница; для UI берём items (ролей немного) */
    list: () =>
      authedRequest<Page<Role>>(`/roles${query({ limit: 100 })}`).then(
        (page) => page.items
      ),
    permissions: () => authedRequest<PermissionDef[]>("/roles/permissions"),
    create: (body: {
      slug: string;
      title?: { ru: string; en?: string; uz?: string };
      description?: string;
      permissions?: string[];
    }) =>
      authedRequest<Role>("/roles", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (
      id: string,
      body: {
        slug?: string;
        title?: { ru: string; en?: string; uz?: string };
        description?: string;
        permissions?: string[];
      }
    ) =>
      authedRequest<Role>(`/roles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (id: string) =>
      authedRequest<void>(`/roles/${id}`, { method: "DELETE" }),
  },
  categories: {
    create: (body: {
      name: { ru: string; en?: string; uz?: string };
      parentId?: string;
      order?: number;
    }) =>
      authedRequest<TicketCategory>("/ticket-categories", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (
      id: string,
      body: {
        name?: { ru: string; en?: string; uz?: string };
        order?: number;
        isActive?: boolean;
        severityId?: string | null;
      }
    ) =>
      authedRequest<TicketCategory>(`/ticket-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (id: string) =>
      authedRequest<void>(`/ticket-categories/${id}`, { method: "DELETE" }),
  },
};

export const settingsApi = {
  list: () => authedRequest<Setting[]>("/settings"),
  update: (key: string, value: number | string | boolean) =>
    authedRequest<Setting>(`/settings/${key}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
  /** Реквизиты организации из Didox — сохраняет и возвращает группу Organization */
  organizationAutofill: (taxId: string) =>
    authedRequest<Setting[]>("/settings/organization/autofill", {
      method: "POST",
      body: JSON.stringify({ taxId }),
    }),
};

export const iikoPartnerApi = {
  profile: (refresh = false) =>
    authedRequest<IikoPartnerProfile>(
      `/iiko-partner/profile${refresh ? "?refresh=true" : ""}`
    ),
  health: () => authedRequest<IikoPartnerHealth>("/iiko-partner/health"),
  servers: {
    list: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      sort?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.search) qs.set("search", params.search);
      if (params?.status) qs.set("status", params.status);
      if (params?.sort) qs.set("sort", params.sort);
      const query = qs.toString();
      return authedRequest<IikoServersList>(
        `/iiko-partner/servers${query ? `?${query}` : ""}`
      );
    },
    events: (id: string, page = 1) =>
      authedRequest<Page<IikoServerEvent>>(
        `/iiko-partner/servers/${id}/events?page=${page}`
      ),
    sync: () =>
      authedRequest<IikoServersSyncResult>("/iiko-partner/servers/sync", {
        method: "POST",
      }),
  },
};

export const venuesApi = {
  list: (params: {
    page?: number;
    limit?: number;
    search?: string;
    kind?: string;
    chainId?: string;
    linked?: boolean;
    active?: boolean;
    sort?: string;
  } = {}) => authedRequest<VenuesList>(`/venues${query({ ...params })}`),
  get: (id: string) => authedRequest<Venue>(`/venues/${id}`),
  linkLegalEntity: (id: string, legalEntityId: string | null) =>
    authedRequest<Venue>(`/venues/${id}/legal-entity`, {
      method: "PATCH",
      body: JSON.stringify({ legalEntityId }),
    }),
  /** Поставить «временно не работает» (until — автовозврат) или снять (null) */
  setStatus: (id: string, status: "temporarily_closed" | null, until?: string | null) =>
    authedRequest<Venue>(`/venues/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(until !== undefined ? { until } : {}) }),
    }),
  sync: () =>
    authedRequest<VenuesSyncResult>("/venues/sync", { method: "POST" }),
  syncCard: (id: string) =>
    authedRequest<Venue>(`/venues/${id}/sync-card`, { method: "POST" }),
};

export const banksApi = {
  /** Справочник банков для выпадашек: смарт-поиск по названию/МФО */
  list: (params: { search?: string; page?: number; limit?: number } = {}) =>
    authedRequest<Page<Bank>>(`/banks${query({ ...params })}`),
};

export interface BankTransactionListParams {
  page?: number;
  limit?: number;
  search?: string;
  /** docDate:desc (default) | docDate:asc | amount:* */
  sort?: string;
  account?: string;
  direction?: BankTransactionDirection;
  dtype?: string;
  state?: string;
  /** Ташкентские дни YYYY-MM-DD */
  dateFrom?: string;
  dateTo?: string;
}

export const bankApi = {
  accounts: {
    list: (params: { enabled?: boolean; sort?: string } = {}) =>
      authedRequest<Page<BankAccount>>(`/bank/accounts${query({ ...params })}`),
    create: (body: {
      branch: string;
      account: string;
      title: string;
      enabled?: boolean;
    }) =>
      authedRequest<BankAccount>("/bank/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<{ title: string; enabled: boolean }>) =>
      authedRequest<BankAccount>(`/bank/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    remove: (id: string) =>
      authedRequest<void>(`/bank/accounts/${id}`, { method: "DELETE" }),
    sync: (id: string) =>
      authedRequest<{ seen: number; upserted: number }>(
        `/bank/accounts/${id}/sync`,
        { method: "POST" }
      ),
  },

  transactions: {
    list: (params: BankTransactionListParams = {}) =>
      authedRequest<Page<BankTransaction>>(
        `/bank/transactions${query({ ...params })}`
      ),
    get: (id: string) =>
      authedRequest<BankTransaction>(`/bank/transactions/${id}`),
    refreshDetails: (id: string) =>
      authedRequest<BankTransaction>(
        `/bank/transactions/${id}/refresh-details`,
        { method: "POST" }
      ),
  },

  reconciliations: {
    list: (
      params: {
        page?: number;
        limit?: number;
        account?: string;
        status?: BankReconciliationStatus;
        dateFrom?: string;
        dateTo?: string;
      } = {}
    ) =>
      authedRequest<Page<BankReconciliation>>(
        `/bank/reconciliations${query({ ...params })}`
      ),
    run: (accountId: string, date: string) =>
      authedRequest<BankReconciliation>("/bank/reconciliations/run", {
        method: "POST",
        body: JSON.stringify({ accountId, date }),
      }),
  },

  rates: () => authedRequest<BankRates>("/bank/rates"),
};

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  type?: ProductType;
  currency?: ProductCurrency;
  isActive?: boolean;
  /** Границы цены — в сумах (сравнение с priceUzs) */
  minPrice?: number;
  maxPrice?: number;
}

export interface ProductInput {
  name: string;
  type?: ProductType;
  price: number;
  currency: ProductCurrency;
  description?: string;
  spic?: string;
  packageCode?: string;
  isActive?: boolean;
}

export const productsApi = {
  list: (params: ProductListParams = {}) =>
    authedRequest<ProductsPage>(`/products${query({ ...params })}`),
  get: (id: string) => authedRequest<Product>(`/products/${id}`),
  create: (body: ProductInput) =>
    authedRequest<Product>("/products", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<ProductInput>) =>
    authedRequest<Product>(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    authedRequest<void>(`/products/${id}`, { method: "DELETE" }),
};

export const severitiesApi = {
  list: () => authedRequest<TicketSeverity[]>("/ticket-severities"),
  create: (body: {
    name: { ru: string; en?: string; uz?: string };
    color: string;
    slaMinutes: number;
    order?: number;
    isDefault?: boolean;
  }) =>
    authedRequest<TicketSeverity>("/ticket-severities", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: Partial<{
      name: { ru: string; en?: string; uz?: string };
      color: string;
      slaMinutes: number;
      order: number;
      isDefault: boolean;
    }>
  ) =>
    authedRequest<TicketSeverity>(`/ticket-severities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    authedRequest<void>(`/ticket-severities/${id}`, { method: "DELETE" }),
};
