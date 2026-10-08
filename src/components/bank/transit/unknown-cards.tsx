"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, Link2, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UserPicker } from "@/components/common/user-picker";
import type { TransitJournal } from "@/lib/api";
import { bankApi } from "@/lib/api-authed";

type UnknownCard = TransitJournal["unknownCards"][number];

/**
 * Выплаты на карточные счета, не связанные с сотрудником. Одно связывание на
 * человека — дальше его выплаты разносятся сами, в том числе задним числом.
 */
export function UnknownCards({
  cards,
  canManage,
  onLinked,
}: {
  cards: UnknownCard[];
  canManage: boolean;
  onLinked: () => void;
}) {
  const t = useTranslations("Bank.transit.unknown");
  if (cards.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-light/30 p-4">
      <div className="flex items-start gap-2.5">
        <UserRoundSearch className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-warning">
            {t("title", { count: cards.length })}
          </h3>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>
      </div>
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-background">
        {cards.map((c) => (
          <UnknownCardRow key={c.cardAccount} card={c} canManage={canManage} onLinked={onLinked} />
        ))}
      </div>
    </section>
  );
}

function UnknownCardRow({
  card,
  canManage,
  onLinked,
}: {
  card: UnknownCard;
  canManage: boolean;
  onLinked: () => void;
}) {
  const t = useTranslations("Bank.transit.unknown");
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function link() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await bankApi.transit.cards.link({
        cardAccount: card.cardAccount,
        userId: user.id,
        bankName: card.bankName || undefined,
        cardNumber: card.cardNumber || undefined,
      });
      toast.success(t("linked", { name: user.name }));
      onLinked();
    } catch {
      toast.error(t("error"));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <CreditCard className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{card.bankName || t("noName")}</span>
        <span className="truncate font-mono text-xs text-muted-foreground tabular-nums">
          {card.cardNumber ? `${card.cardNumber} · ` : ""}
          {card.cardAccount}
        </span>
      </div>
      {canManage && (
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <UserPicker
            value={user}
            onChange={setUser}
            placeholder={t("pickEmployee")}
            className="min-w-0 flex-1 sm:w-56"
          />
          <Button size="sm" disabled={!user || busy} onClick={() => void link()} className="gap-1.5">
            {busy ? <Spinner className="size-4" /> : <Link2 className="size-4" />}
            {t("link")}
          </Button>
        </div>
      )}
    </div>
  );
}
