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

/** Локализованная строка: ru — источник истины, en/uz фолбэк на ru */
export interface LocalizedString {
  ru: string;
  en: string;
  uz: string;
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
  /** Пустая строка — не указана */
  lastName: string;
  /** YYYY-MM-DD или null */
  birthDate: string | null;
  role: {
    id: string;
    slug: string;
    title: LocalizedString;
    permissions: string[];
  };
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

/** Юрлицо, к которому привязан тикет (сокращённая форма) */
export interface TicketLegalEntity {
  id: string;
  name: string;
  /** Название заведения («Ресторан „У Бабушки"»), пустая строка если не задано */
  establishment: string;
  taxId: string;
}

/** Важность тикета (справочник, staff-only) */
export interface TicketSeverity {
  id: string;
  name: LocalizedString;
  /** #RRGGBB для бейджа */
  color: string;
  slaMinutes: number;
  order: number;
  isDefault: boolean;
}

export interface TicketParticipant {
  user: TicketAuthor;
  joinedAt: string;
}

export interface Ticket {
  id: string;
  subject: string;
  author: TicketAuthor;
  category: LocalizedString;
  subcategory: LocalizedString | null;
  legalEntity: TicketLegalEntity | null;
  status: TicketStatus;
  /** Для клиента всегда null (анонимность поддержки) */
  assignee: TicketAuthor | null;
  /** Оценка автора после закрытия (1-5), null — не оценён */
  rating: number | null;
  review: string;
  lastMessageAt: string;
  createdAt: string;
  /** Непрочитанные сообщения для текущего пользователя */
  unreadCount?: number;
  // --- Staff-only (отсутствуют в клиентской проекции) ---
  severity?: Pick<TicketSeverity, "id" | "name" | "color" | "slaMinutes"> | null;
  /** Дедлайн взятия И первого ответа; null — вне SLA (легаси/переоткрытые) */
  slaDeadline?: string | null;
  /** Красная метка — не снимается */
  slaBreached?: boolean;
  slaClaimBreachedAt?: string | null;
  slaResponseBreachedAt?: string | null;
  /** Первое взятие в работу */
  claimedAt?: string | null;
  firstSupportReplyAt?: string | null;
  /** Кто сейчас в чате (staff) */
  participants?: TicketParticipant[];
}

export type TicketMessageType = "user" | "system";

export interface TicketMessage {
  id: string;
  ticketId: string;
  /** Для клиента у сообщений поддержки — {id: "support", name: "Поддержка"} */
  author: TicketAuthor;
  text: string;
  /** system — сгенерировано сервером (смена статуса) */
  type: TicketMessageType;
  /**
   * Для type=system: ticket_closed | ticket_reopened | ticket_claimed |
   * ticket_left | ticket_severity_changed; author — кто, createdAt — когда
   */
  systemEvent: string | null;
  /** Сообщение от поддержки (для клиента author анонимен) */
  fromSupport: boolean;
  /** Staff-only: невидимо клиенту (аудит claim/leave/severity) */
  staffOnly?: boolean;
  /** Staff-only: payload события (например, {from, to} у смены важности) */
  meta?: Record<string, unknown> | null;
  attachments: FileAttachment[];
  createdAt: string;
}

export interface Role {
  id: string;
  /** Машинный идентификатор (lowercase) */
  slug: string;
  /** Отображаемое название */
  title: LocalizedString;
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
  /** Важность по умолчанию для тикетов категории (staff-only в дереве) */
  severityId?: string | null;
  /** Только у корневых */
  children: TicketCategory[];
}

export interface LegalEntityDirector {
  firstName: string;
  lastName: string;
  middleName: string;
}

/** Роль членства внутри ЮЛ: owner управляет доступами, member — просто доступ */
export type EntityMemberRole = "owner" | "member";

export interface LegalEntityMember {
  id: string;
  name: string;
  lastName: string;
  phone: string;
  role: EntityMemberRole;
  /** id должностей участника (модуль чеклистов) */
  positions: string[];
}

export interface EntityInvite {
  id: string;
  phone: string;
  role: EntityMemberRole;
  createdAt: string;
}

export type AccessRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface AccessRequestUser {
  id: string;
  name: string;
  lastName: string;
  phone: string;
}

export interface AccessRequest {
  id: string;
  taxId: string;
  /** id ЮЛ, если оно уже есть в системе */
  entityId: string | null;
  /** Пустая строка — ЮЛ ещё не заведено (запрос ушёл ТП) */
  entityName: string;
  comment: string;
  status: AccessRequestStatus;
  rejectReason: string;
  createdAt: string;
  decidedAt: string | null;
  /** Автор запроса — только во входящем списке (у owner'ов/ТП) */
  user?: AccessRequestUser;
}

export interface LegalEntity {
  id: string;
  /** ИНН (9 цифр) или ПИНФЛ (14) */
  taxId: string;
  name: string;
  rawName: string;
  /** Название заведения («Ресторан „У Бабушки"»), пустая строка если не задано */
  establishment: string;
  bankCode: string;
  bankAccount: string;
  address: string;
  director: LegalEntityDirector | null;
  registrationDate: string | null;
  /** Только для staff и owner'ов в GET /legal-entities/:id */
  members?: LegalEntityMember[];
  createdAt: string;
}

export interface LegalEntityLookup {
  name: string;
  taxId: string;
  rawName: string;
  bankCode: string;
  bankAccount: string;
  address: string;
  director: LegalEntityDirector | null;
  registrationDate: string | null;
}

// --- Чеклисты (API 0.17) ---------------------------------------------------

export interface Position {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
}

export type ChecklistItemType = "checkbox" | "text" | "number" | "scale" | "photo";

export interface ChecklistItem {
  id: string;
  type: ChecklistItemType;
  title: string;
  /** Нельзя завершить без ответа */
  required: boolean;
  /** Нужно ≥1 фото */
  requirePhoto: boolean;
}

/** Пункт при создании/правке: у существующих передавать id, чтобы история осталась связана */
export interface ChecklistItemInput {
  id?: string;
  type: ChecklistItemType;
  title: string;
  required?: boolean;
  requirePhoto?: boolean;
}

export type ChecklistKind = "entity" | "personal";

export interface ChecklistTemplate {
  id: string;
  kind: ChecklistKind;
  entityId: string | null;
  name: string;
  description: string;
  items: ChecklistItem[];
  version: number;
  /** Анти-фрод: фото должно быть снято за последние N минут; null — выкл */
  photoFreshnessMinutes: number | null;
  archived: boolean;
  createdAt: string;
}

export interface ChecklistSchedule {
  id: string;
  templateId: string;
  entityId: string | null;
  enabled: boolean;
  /** 0=Вс … 6=Сб */
  daysOfWeek: number[];
  /** Местное время Ташкента, HH:mm */
  times: string[];
  windowMinutes: number;
  /** Можно проходить после срока (default true) — результат пометится «не вовремя» */
  allowLateCompletion: boolean;
  assigneeUsers: string[];
  assigneePositions: string[];
  /** UTC-момент следующего слота */
  nextRunAt: string;
  createdAt: string;
}

export type ChecklistRunStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "missed"
  | "cancelled";

export type ChecklistRunOrigin = "scheduled" | "manual";

export interface ChecklistAnswer {
  /** id пункта из items */
  item: string;
  value: boolean | string | number | null;
  /** file id — показ через /api/files/{id} */
  photos: string[];
  comment: string;
}

export interface ChecklistRun {
  id: string;
  entityId: string | null;
  templateId: string;
  templateVersion: number;
  templateName: string;
  userId: string;
  origin: ChecklistRunOrigin;
  status: ChecklistRunStatus;
  scheduledAt: string;
  /** null — ручной запуск, без дедлайна */
  expiresAt: string | null;
  /** Свежесть фото в минутах; null — без проверки */
  photoFreshnessMinutes: number | null;
  /** Можно завершать после срока (унаследовано от расписания) */
  allowLateCompletion: boolean;
  /** Завершён после истечения окна («не вовремя») */
  completedLate: boolean;
  startedAt: string | null;
  completedAt: string | null;
  /** Снапшот пунктов на момент создания задания */
  items: ChecklistItem[];
  answers: ChecklistAnswer[];
}

export interface ChecklistStatsBucket {
  id: string;
  label: string;
  generated: number;
  /** Вовремя */
  completed: number;
  /** После срока */
  completedLate: number;
  missed: number;
  onTimePct: number;
}

export interface ChecklistStats {
  totals: {
    generated: number;
    completed: number;
    completedLate: number;
    missed: number;
    onTimePct: number;
  };
  byTemplate: ChecklistStatsBucket[];
  byUser: ChecklistStatsBucket[];
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
