import {
  ApiError,
  request,
  type AuthSession,
  type NotificationsPage,
  type Page,
  type PermissionDef,
  type Role,
  type Ticket,
  type TicketCategory,
  type TicketMessage,
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
  status?: TicketStatus;
  categoryId?: string;
  all?: boolean;
}

export const ticketsApi = {
  list: (params: TicketListParams = {}) =>
    authedRequest<Page<Ticket>>(`/tickets${query({ ...params })}`),

  get: (id: string) => authedRequest<Ticket>(`/tickets/${id}`),

  create: (body: {
    subject: string;
    categoryId: string;
    subcategoryId?: string;
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
  updateMe: (body: { name: string }) =>
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

export interface AdminUsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "blocked";
  roleId?: string;
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
      name: string;
      description?: string;
      permissions?: string[];
    }) =>
      authedRequest<Role>("/roles", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (
      id: string,
      body: { name?: string; description?: string; permissions?: string[] }
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
