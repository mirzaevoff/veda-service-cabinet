"use client";

import { use } from "react";
import { TransitJournalPage } from "@/components/bank/transit/transit-journal";

/** Журнал зарплатного транзита */
export default function TransitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TransitJournalPage accountId={id} />;
}
