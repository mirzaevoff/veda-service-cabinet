const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.vedavector.com";

/** Единый формат ошибок API: {code, message, data?} — см. md_docs/errors.md */
export interface ApiErrorBody {
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

export class ApiError extends Error {
  code: string;
  status: number;
  data?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.data = body.data;
  }

  /** Секунды до повторной отправки (ER204) */
  get retryAfter(): number | undefined {
    const value = this.data?.retryAfter;
    return typeof value === "number" ? value : undefined;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, { code: "NETWORK", message: "Network error" });
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body ?? { code: "ER100", message: "Unexpected error" }
    );
  }
  return body as T;
}

export interface OtpSession {
  phone: string;
  /** Жизнь кода, сек */
  expiresIn: number;
  /** Через сколько секунд можно отправить снова */
  resendIn: number;
}

export interface UserProfile {
  id: string;
  phone: string;
  name: string;
  role: { id: string; name: string; permissions: string[] };
  status: "active" | "blocked";
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  /** Для метки current в списке сессий */
  sessionId?: string;
  user: UserProfile;
}

export interface SessionDevice {
  name: string;
  platform: "ios" | "android" | "web";
  osVersion: string;
  appVersion: string;
}

export interface AuthSession {
  id: string;
  device: SessionDevice | null;
  current?: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

export interface AppNotification {
  id: string;
  /** Markdown-текст (может быть null, если только картинка) */
  text: string | null;
  imageUrl: string | null;
  button: { text: string; url: string } | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage extends Page<AppNotification> {
  unread: number;
}

export interface ApiInfo {
  name: string;
  version: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type TicketStatus = "open" | "closed";

export interface TicketAuthor {
  id: string;
  name: string;
  phone: string;
}

export type FileKind = "image" | "video" | "audio" | "file";

export interface FileAttachment {
  id: string;
  kind: FileKind;
  mime: string;
  size: number;
  originalName: string;
  url: string;
}

/** Локализованная строка: ru — источник истины, en/uz фолбэк на ru */
export interface LocalizedString {
  ru: string;
  en: string;
  uz: string;
}

export interface Ticket {
  id: string;
  subject: string;
  author: TicketAuthor;
  category: LocalizedString;
  subcategory: LocalizedString | null;
  status: TicketStatus;
  assignee: TicketAuthor | null;
  lastMessageAt: string;
  createdAt: string;
  /** Непрочитанные сообщения для текущего пользователя */
  unreadCount?: number;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  author: TicketAuthor;
  text: string;
  attachments: FileAttachment[];
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
}

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

export interface TicketCategory {
  id: string;
  name: LocalizedString;
  isActive: boolean;
  order: number;
  /** Только у корневых */
  children: TicketCategory[];
}

export const api = {
  info: () => request<ApiInfo>("/"),

  login: (phone: string) =>
    request<OtpSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  register: (phone: string, name: string) =>
    request<OtpSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ phone, name }),
    }),

  verify: (phone: string, code: string) =>
    request<AuthTokens>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),

  refresh: (refreshToken: string) =>
    request<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    request<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  me: (accessToken: string) =>
    request<UserProfile>("/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};
