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
  /** Последняя авторизованная активность (ISO) или null */
  lastSeenAt?: string | null;
  /** Активность за последние 5 минут (вычисляется сервером) */
  online?: boolean;
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
  /** Название заведения — legacy, из создания/правки убрано; пусто у новых */
  establishment: string;
  /** ПИНФЛ физлица (ИП, найденного по ИНН); у компаний пусто */
  pinfl: string;
  bankCode: string;
  /** Название банка (из собственного справочника, по МФО) */
  bank: string;
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
  /** ПИНФЛ физлица (ИП); у компаний пусто */
  pinfl: string;
  bankCode: string;
  /** Название банка из нашего справочника (по МФО) */
  bank: string;
  bankAccount: string;
  address: string;
  director: LegalEntityDirector | null;
  registrationDate: string | null;
}

/** Справочник банков (зеркало классификатора Didox) */
export interface Bank {
  /** МФО (= bankCode) */
  bankId: string;
  name: string;
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

// --- Глобальные настройки и каталог (API 0.20) ------------------------------

export type SettingType = "number" | "string" | "boolean";

export interface Setting {
  key: string;
  value: number | string | boolean;
  type: SettingType;
  /** Подпись из реестра на сервере (не локализуется) */
  label: string;
  group: string;
  default: number | string | boolean;
  description?: string;
  min?: number;
  max?: number;
  /** Write-only: GET отдаёт маску вместо значения, PATCH с маской игнорируется */
  secret?: boolean;
  updatedAt: string;
}

export type ProductType = "iikoSaaS" | "iikoCloud" | "other";
export type ProductCurrency = "USD" | "UZS";

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  price: number;
  currency: ProductCurrency;
  /** Сумовой эквивалент: USD пересчитан по глобальному курсу */
  priceUzs: number;
  description: string;
  /** ИКПУ */
  spic: string;
  packageCode: string;
  isActive: boolean;
  createdAt: string;
}

/** Страница каталога: плюс курс, по которому посчитаны суммы */
export interface ProductsPage extends Page<Product> {
  usdRate: number;
}

// --- Банк (Kapitalbank, API 0.21) -------------------------------------------

/** Снапшот остатков/оборотов счёта из GetAcc1C (суммы в тийинах) */
export interface BankAccountSnapshot {
  name: string;
  val: string;
  /** Входящий остаток */
  s_in: number;
  /** Исходящий остаток */
  s_out: number;
  /** Обороты дебет */
  dt: number;
  /** Обороты кредит */
  ct: number;
  /** Доступно к оплате */
  canpay: number;
  state: number;
  stateName: string;
  syncedAt: string;
}

export interface BankAccount {
  id: string;
  /** МФО, 5 цифр — иммутабелен */
  branch: string;
  /** Номер счёта, 20 цифр — иммутабелен */
  account: string;
  title: string;
  enabled: boolean;
  snapshot: BankAccountSnapshot | null;
  lastSyncAt: string | null;
  lastSyncOkAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export type BankTransactionDirection = "in" | "out";
export type BankTransactionSource = "kapitalbank" | "system";

/** Банковские поля хранятся дословно (snake_case банка); суммы в тийинах */
export interface BankTransaction {
  id: string;
  source: BankTransactionSource;
  bankAccountId: string;
  /** UTC-инстант ташкентской полуночи ddate */
  docDate: string;
  /** Вычислено по своему счёту (полю dir банка не доверяем) */
  direction: BankTransactionDirection;
  /** Контрагент — тоже наш отслеживаемый счёт (перевод между своими) */
  counterpartyTracked: boolean;
  amount: number;
  b2_id: string;
  num: string;
  ddate: string;
  mfo_dt: string;
  acc_dt: string;
  name_dt: string;
  inn_dt: string;
  mfo_ct: string;
  acc_ct: string;
  name_ct: string;
  inn_ct: string;
  purpose: string;
  purp_code: string;
  dtype: string;
  state: number | null;
  syncedAt: string;
  raw: Record<string, unknown>;
  detailsRaw: Record<string, unknown> | null;
}

export type BankReconciliationStatus =
  | "matched"
  | "discrepancy"
  | "unconfirmed"
  | "error";

export interface BankReconciliation {
  id: string;
  bankAccountId: string;
  /** Ташкентский день YYYY-MM-DD */
  date: string;
  status: BankReconciliationStatus;
  bankDocCount: number;
  ourDocCount: number;
  bankTotalDebit: number;
  bankTotalCredit: number;
  ourTotalDebit: number;
  ourTotalCredit: number;
  bankSaldoIn: number;
  bankSaldoOut: number;
  /** 1 — день закрыт банком окончательно */
  fin: number | null;
  operDayState: string;
  attempts: number;
  message: string;
  finalizedAt: string | null;
}

export interface BankRate {
  order?: string;
  flag_url?: string;
  kod?: string;
  char_kod?: string;
  name?: string;
  course_cb?: string;
  change_cb?: string;
  course_buy?: string;
  change_buy?: string;
  course_sell?: string;
  change_sell?: string;
}

export interface BankRates {
  filial?: string;
  date?: string;
  time?: string;
  courses: BankRate[];
  /** Банк не ответил — отдан последний кэш */
  stale: boolean;
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

// ─── iiko Partner (партнёрский портал pp.iiko.ru) ───

export interface IikoPartnerPhone {
  number: string;
  label: string | null;
}

export interface IikoPartnerCompany {
  name: string;
  addressLines: string[];
  phones: IikoPartnerPhone[];
  email: string | null;
}

export interface IikoPartnerMetric {
  label: string;
  /** Как отображено на портале */
  value: string;
  valueNumber: number | null;
  period: string;
  /** Рост год к году, % */
  yoyPercent: number | null;
  trend: "up" | "down" | null;
}

export interface IikoPartnerManager {
  name: string;
  email: string | null;
}

export interface IikoPartnerStatus {
  status: string;
  discountPercent: number | null;
  masterPartner: string | null;
  metrics: IikoPartnerMetric[];
  manager: IikoPartnerManager | null;
}

export interface IikoPartnerProfile {
  company: IikoPartnerCompany;
  partner: IikoPartnerStatus;
  fetchedAt: string;
  /** Отдано из 5-минутного кэша */
  cached: boolean;
  /** Портал недоступен — отдана просроченная копия */
  stale: boolean;
}

export interface IikoPartnerHealth {
  mode: "mock" | "real";
  configured: boolean;
  baseUrl: string;
  profileCachedAt: string | null;
}

export type IikoServerStatus = "up" | "down" | "maintenance" | "unknown";

export interface IikoServer {
  id: string;
  uid: string;
  clientId: string | null;
  pointName: string;
  version: string;
  status: IikoServerStatus;
  statusChangedAt: string;
  /** Заполнено, пока сервер недоступен */
  downSince: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface IikoServersSummary {
  total: number;
  up: number;
  down: number;
  maintenance: number;
  unknown: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

export interface IikoServersList extends Page<IikoServer> {
  summary: IikoServersSummary;
}

export interface IikoServerEvent {
  id: string;
  uid: string;
  pointName: string;
  /** null — сервер впервые появился в списке */
  from: IikoServerStatus | null;
  to: IikoServerStatus;
  at: string;
}

export type IikoInvoiceKind = "customer" | "partner";
export type IikoInvoiceCurrency = "USD" | "RUB";

/** Наше заведение, сматченное по clientId (read-only джойн, null если нет) */
export interface IikoInvoiceVenue {
  id: string;
  iikoClientId: string;
  uid: string;
  name: string;
  active: boolean;
}

export interface IikoInvoice {
  id: string;
  kind: IikoInvoiceKind;
  invoiceNumber: string;
  invoiceId: string | null;
  clientId: string | null;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  partner: string;
  endCustomer: string;
  legalEntityTaxId: string;
  legalEntityName: string;
  description: string;
  /** Целые минорные единицы (÷100) */
  amountMinor: number;
  currency: IikoInvoiceCurrency;
  active: boolean;
  removedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Наше заведение по clientId (или null) */
  venue: IikoInvoiceVenue | null;
  /** Модалка invoice-info — только в детали */
  card?: Record<string, unknown> | null;
}

export interface IikoInvoiceKindTotal {
  currency: IikoInvoiceCurrency;
  /** Сумма amountMinor (÷100) */
  amount: number;
  count: number;
}

export interface IikoInvoiceReceivableCustomer extends IikoInvoiceKindTotal {
  /** Число должников (заведений/клиентов) */
  debtors: number;
}

export interface IikoInvoiceMonthPoint {
  /** YYYY-MM */
  month: string;
  /** Выставлено клиентам (USD minor) */
  customer: number;
  /** Выставлено партнёру (RUB minor) */
  partner: number;
}

export interface IikoInvoicesSummary {
  /** Период сводки (YTD, если без фильтра дат) */
  scope: { from: string; to: string | null; ytd: boolean };
  total: number;
  paid: number;
  /** Не оплачено = статус ∉ {Paid, Cancelled} */
  unpaid: number;
  cancelled: number;
  byStatus: Record<string, number>;
  /** Суммы за период по видам */
  totals: {
    customer?: IikoInvoiceKindTotal;
    partner?: IikoInvoiceKindTotal;
  };
  /** Долги (неоплаченные): customer — нам должны (+должники); partner — мы должны iiko */
  receivable: {
    customer?: IikoInvoiceReceivableCustomer;
    partner?: IikoInvoiceKindTotal;
  };
  /** Помесячно выставлено (для графика) */
  byMonth: IikoInvoiceMonthPoint[];
  lastSyncAt: string | null;
  lastFullSyncAt: string | null;
  lastSyncError: string | null;
}

export interface IikoInvoicesList extends Page<IikoInvoice> {
  summary: IikoInvoicesSummary;
}

export interface IikoInvoicesSyncResult {
  seen: number;
  created: number;
  updated: number;
  deactivated: number;
  partial: boolean;
  full: boolean;
}

export interface IikoServersSyncResult {
  seen: number;
  created: number;
  transitions: number;
  /** Пагинация портала не дотянула все строки */
  partial: boolean;
}

// ─── Venues (заведения клиентов поверх данных iiko) ───

export type VenueKind = "rms" | "chain";

/** Эффективный статус: ручной temporarily_closed перекрывает авто open/closed по серверу */
export type VenueStatus = "open" | "closed" | "temporarily_closed";

export interface VenueRef {
  id: string;
  name: string;
}

/** Живой статус сервера точки из мониторинга iiko-partner */
export interface VenueServer {
  uid: string;
  status: IikoServerStatus;
  statusChangedAt: string;
  downSince: string | null;
  version: string;
}

export interface Venue {
  id: string;
  iikoClientId: string;
  kind: VenueKind;
  uid: string;
  name: string;
  type: string;
  city: string;
  /** Родительская сеть (для RMS внутри сети) */
  chain: VenueRef | null;
  chainName: string;
  address: string;
  phone: string;
  email: string;
  emailForInvoices: string;
  manager: string;
  /** ЮЛ, как его видит iiko (часто мусор) */
  iikoLegalEntityName: string;
  iikoTaxId: string;
  version: string;
  hostingLink: string;
  webLink: string;
  /** НАШЕ привязанное ЮЛ */
  legalEntity: VenueRef | null;
  /** Живой статус сервера (null — точки нет в мониторинге) */
  server: VenueServer | null;
  status: VenueStatus;
  /** Ручной override админа (null — автоматически) */
  manualStatus: "temporarily_closed" | null;
  manualStatusUntil: string | null;
  active: boolean;
  cardSyncedAt: string | null;
  lastSeenAt: string;
}

export interface VenuesSummary {
  rms: number;
  chains: number;
  linked: number;
  lastListSyncAt: string | null;
  lastListSyncError: string | null;
}

export interface VenuesList extends Page<Venue> {
  summary: VenuesSummary;
}

export interface VenuesSyncResult {
  seen: number;
  created: number;
  chains: number;
  deactivated: number;
  partial: boolean;
}

// ─── Dashboard (агрегат для главной; блоки по правам, без права — null) ───

export interface DashboardRatesBlock {
  date: string | null;
  items: Array<{
    charCode: string;
    name: string;
    buy: string;
    sell: string;
    cb: string;
  }>;
  stale: boolean;
}

export interface DashboardServersBlock {
  total: number;
  up: number;
  down: number;
  maintenance: number;
  unknown: number;
  lastSyncAt: string | null;
}

export interface DashboardVenuesBlock {
  total: number;
  rms: number;
  chains: number;
  /** Привязаны к нашему ЮЛ */
  linked: number;
  open: number;
  closed: number;
  temporarilyClosed: number;
}

export interface DashboardTicketsBlock {
  open: number;
  closed: number;
  /** Открытые, никем не взятые */
  unclaimed: number;
  /** Открытые с просроченным SLA */
  breached: number;
}

export interface DashboardUsersBlock {
  total: number;
  /** Активность за последние 5 минут */
  online: number;
}

export interface Dashboard {
  rates: DashboardRatesBlock | null;
  servers: DashboardServersBlock | null;
  venues: DashboardVenuesBlock | null;
  tickets: DashboardTicketsBlock | null;
  users: DashboardUsersBlock | null;
  generatedAt: string;
}

// ─── Баланс ЮЛ (леджер, тийины) ───

export type LedgerType = "topup" | "correction" | "audit";
export type LedgerSource = "bank" | "manual" | "audit";

export interface EntityBalance {
  legalEntityId: string;
  balanceTiyin: number;
  /** balanceTiyin / 100 */
  balanceSum: number;
  /** Σ леджера (источник истины) */
  computedTiyin: number;
  /** кэш == леджер */
  inSync: boolean;
}

export interface LedgerEntry {
  id: string;
  legalEntityId: string | null;
  /** Название ЮЛ — только в глобальном фиде */
  legalEntityName?: string | null;
  type: LedgerType;
  amountTiyin: number;
  /** amountTiyin / 100 */
  amountSum: number;
  currency: string;
  source: LedgerSource;
  bankTransactionId: string | null;
  recognized: boolean;
  payer: { inn: string; account: string; name: string } | null;
  comment: string;
  createdAt: string;
}

export type LedgerList = Page<LedgerEntry>;

export interface BalanceAuditResult {
  backfilled: number;
  recognized: number;
  entitiesHealed: number;
}
