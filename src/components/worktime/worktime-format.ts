import type {
  AttendanceDayStatus,
  EmployeeLedgerEntryType,
  LeaveType,
  PayrollStatus,
  TimesheetDay,
  TimesheetStatus,
} from "@/lib/api";

/**
 * Цвет бейджа статуса дня — единая легенда табеля.
 * В ТЗ «отсутствие» синее, но по STYLEGUIDE единственный акцент — красный,
 * поэтому используем токены дизайн-системы; статусы дополнительно различаются
 * буквой в сетке табеля (см. dayStatusLetter).
 */
export function dayStatusStyle(status: AttendanceDayStatus): string {
  switch (status) {
    case "present":
      return "bg-success-light text-success";
    case "late":
    case "incomplete":
      return "bg-warning-light text-warning";
    case "absent":
      return "bg-destructive/10 text-destructive";
    case "leave":
      return "bg-accent-light text-primary";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

/** Буква дня для сетки табеля (по мотивам Т-13) */
export function dayStatusLetter(day: TimesheetDay): string {
  switch (day.status) {
    case "present":
      return "Я";
    case "late":
      return "О";
    case "incomplete":
      return "?";
    case "absent":
      return "Н";
    case "leave":
      return leaveLetter(day.leaveType);
    default:
      return "В";
  }
}

function leaveLetter(type: LeaveType | null | undefined): string {
  switch (type) {
    case "sick":
      return "Б";
    case "dayoff":
      return "ОТ";
    case "unpaid":
      return "БС";
    default:
      return "ОП";
  }
}

export function timesheetStatusStyle(status: TimesheetStatus): string {
  return status === "approved"
    ? "bg-success-light text-success"
    : "bg-secondary text-muted-foreground";
}

export function payrollStatusStyle(status: PayrollStatus): string {
  return status === "approved"
    ? "bg-success-light text-success"
    : "bg-secondary text-muted-foreground";
}

/** Начисление зелёное (+), выплата — обычная (−) */
export function ledgerTypeStyle(type: EmployeeLedgerEntryType): string {
  switch (type) {
    case "accrual":
    case "bonus":
      return "text-success";
    case "payment":
    case "deduction":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

/** Тийины со знаком: «+5 000 сум» / «−5 000 сум» */
export function formatSignedTiyin(tiyin: number, locale: string): string {
  const sum = Math.round(Math.abs(tiyin) / 100).toLocaleString(locale);
  const sign = tiyin < 0 ? "−" : "+";
  return `${sign}${sum} сум`;
}

/** Дни месяца «YYYY-MM» → массив «YYYY-MM-DD» */
export function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from(
    { length: total },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`
  );
}

/** Номер дня недели (1 — Пн … 7 — Вс) для «YYYY-MM-DD» */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}
