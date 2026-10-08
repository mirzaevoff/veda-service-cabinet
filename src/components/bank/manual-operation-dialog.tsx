"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { DatePicker } from "@/components/common/date-picker";
import {
  ApiError,
  type BankAccount,
  type BankTransaction,
  type BankTransactionDirection,
  type CashCategory,
  type ManualTransactionUpdate,
} from "@/lib/api";
import { bankApi } from "@/lib/api-authed";
import { cn } from "@/lib/utils";
import { formatTiyin, parseSumToTiyin, tiyinToSumInput } from "./bank-money";
import { categoriesFor } from "./use-cash-categories";

function todayYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * docDate приходит UTC-инстантом ташкентской полуночи («…-10-04T19:00:00Z» =
 * 5 октября). slice(0,10) дал бы предыдущий день — переводим в ташкентские
 * сутки (UTC+5 круглый год, без перехода на летнее время).
 */
function tashkentYmd(iso: string): string {
  return new Date(Date.parse(iso) + 5 * 3600_000).toISOString().slice(0, 10);
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Экран 2: операция вручную. Создание — на ручной счёт/карту; правка — только
 * для операций, введённых вручную. Сумма вводится в сумах → тийины целым.
 *
 * requestId рождается ОДИН раз при открытии формы создания и переживает
 * повторы после ошибки сети: повтор с тем же id вернёт уже созданную
 * операцию, а не проведёт деньги второй раз.
 */
export function ManualOperationDialog({
  open,
  onClose,
  account,
  transaction,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Создание: счёт/карта, куда пишем */
  account?: BankAccount | null;
  /** Правка: ручная операция */
  transaction?: BankTransaction | null;
  categories: CashCategory[];
  onSaved: (tx: BankTransaction) => void;
}) {
  const t = useTranslations("Bank.operation");
  const tc = useTranslations("Common");
  const editing = !!transaction;

  const [docDate, setDocDate] = useState("");
  const [direction, setDirection] = useState<BankTransactionDirection>("out");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [purpose, setPurpose] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const requestIdRef = useRef<string>("");
  const submittingRef = useRef(false);

  // Инициализация при открытии — и ТОЛЬКО тогда новый requestId
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- инициализация формы при открытии */
    setError(null);
    setSaving(false);
    submittingRef.current = false;
    if (transaction) {
      setDocDate(tashkentYmd(transaction.docDate));
      setDirection(transaction.direction);
      setAmount(tiyinToSumInput(transaction.amount));
      setCategoryId(transaction.categoryId ?? "");
      setCounterparty(transaction.counterpartyName);
      setPurpose(transaction.purpose);
      setDocNumber(transaction.num);
    } else {
      requestIdRef.current = newRequestId();
      setDocDate(todayYmd());
      setDirection("out");
      setAmount("");
      setCategoryId("");
      setCounterparty("");
      setPurpose("");
      setDocNumber("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно только при открытии
  }, [open]);

  const available = categoriesFor(categories, direction);
  // При правке оставляем в списке текущую статью, даже если она в архиве
  const current = categories.find((c) => c.id === categoryId);
  const options =
    current && !available.some((c) => c.id === current.id) ? [current, ...available] : available;

  function changeDirection(next: BankTransactionDirection) {
    setDirection(next);
    // Статья другого направления дала бы ER1212 — снимаем её сразу
    const cat = categories.find((c) => c.id === categoryId);
    if (cat && cat.direction !== "both" && cat.direction !== next) setCategoryId("");
  }

  const tiyin = parseSumToTiyin(amount);
  const amountInvalid = amount.trim() !== "" && (tiyin === null || tiyin <= 0);

  async function save() {
    if (submittingRef.current) return; // двойной клик
    if (!docDate) return setError(t("errors.date"));
    if (tiyin === null || tiyin <= 0) return setError(t("errors.amount"));

    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      let saved: BankTransaction;
      if (transaction) {
        const patch: ManualTransactionUpdate = {};
        if (docDate !== tashkentYmd(transaction.docDate)) patch.docDate = docDate;
        if (direction !== transaction.direction) patch.direction = direction;
        if (tiyin !== transaction.amount) patch.amount = tiyin;
        if (counterparty.trim() !== transaction.counterpartyName)
          patch.counterpartyName = counterparty.trim();
        if (purpose.trim() !== transaction.purpose) patch.purpose = purpose.trim();
        // Смена направления — статью шлём всегда: API перепроверит пару
        if ((categoryId || null) !== transaction.categoryId || patch.direction)
          patch.categoryId = categoryId || null;
        if (Object.keys(patch).length === 0) {
          onClose();
          return;
        }
        saved = await bankApi.transactions.update(transaction.id, patch);
        toast.success(t("updated"));
      } else {
        if (!account) return;
        saved = await bankApi.transactions.createManual(account.id, {
          docDate,
          direction,
          amount: tiyin,
          categoryId: categoryId || undefined,
          counterpartyName: counterparty.trim() || undefined,
          purpose: purpose.trim() || undefined,
          docNumber: docNumber.trim() || undefined,
          requestId: requestIdRef.current,
        });
        toast.success(t("created"));
      }
      onSaved(saved);
      onClose();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      if (code === "NETWORK") setError(t("errors.network"));
      else if (code === "ER1207") setError(t("errors.synced"));
      else if (code === "ER1208") setError(t("errors.notManual"));
      else if (code === "ER1212") setError(t("errors.categoryDirection"));
      else if (code === "ER1210") setError(t("errors.categoryNotFound"));
      else setError(t("errors.generic"));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {editing ? t("editHint") : account ? account.title : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Направление */}
          <div className="grid grid-cols-2 gap-2">
            {(["in", "out"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => changeDirection(d)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                  direction === d
                    ? d === "in"
                      ? "border-success/50 bg-success-light text-success"
                      : "border-primary/40 bg-accent-light text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {d === "in" ? (
                  <ArrowDownLeft className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
                {d === "in" ? t("in") : t("out")}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-amount" className="text-sm text-muted-foreground">
                {t("amount")}
              </Label>
              <Input
                id="op-amount"
                value={amount}
                inputMode="decimal"
                placeholder="5 000 000"
                autoFocus={!editing}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                aria-invalid={amountInvalid}
                className="text-lg font-semibold tabular-nums"
              />
              <span
                className={cn(
                  "text-xs tabular-nums",
                  amountInvalid ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {amountInvalid
                  ? t("amountInvalid")
                  : tiyin
                    ? t("amountPreview", { sum: formatTiyin(tiyin) })
                    : t("amountHint")}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm text-muted-foreground">{t("date")}</Label>
              <DatePicker recent value={docDate} onChange={setDocDate} placeholder={t("date")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="op-category" className="text-sm text-muted-foreground">
              {t("category")}
            </Label>
            <select
              id="op-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-transparent px-2.5 text-sm outline-none focus-visible:border-primary/40"
            >
              <option value="">{t("noCategory")}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.archived ? ` (${t("archived")})` : ""}
                </option>
              ))}
            </select>
            {options.length === 0 && (
              <span className="text-xs text-muted-foreground">{t("noCategoriesHint")}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="op-counterparty" className="text-sm text-muted-foreground">
              {direction === "in" ? t("counterpartyIn") : t("counterpartyOut")}
            </Label>
            <Input
              id="op-counterparty"
              value={counterparty}
              maxLength={200}
              onChange={(e) => setCounterparty(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="op-purpose" className="text-sm text-muted-foreground">
              {t("purpose")}
            </Label>
            <textarea
              id="op-purpose"
              value={purpose}
              maxLength={500}
              rows={2}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-primary/40"
            />
          </div>

          {!editing && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-num" className="text-sm text-muted-foreground">
                {t("docNumber")}
              </Label>
              <Input
                id="op-num"
                value={docNumber}
                maxLength={40}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-40 tabular-nums"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving || amountInvalid}>
            {saving ? <Spinner className="size-4" /> : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
