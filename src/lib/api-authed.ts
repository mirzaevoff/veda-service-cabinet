import {
  ApiError,
  request,
  type Page,
  type Ticket,
  type TicketCategory,
  type TicketMessage,
  type TicketStatus,
  type UserProfile,
} from "./api";
import { clearSession, getAccessToken, refreshSession } from "./auth";

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
};

export const usersApi = {
  me: () => authedRequest<UserProfile>("/users/me"),
};
