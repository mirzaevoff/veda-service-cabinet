import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { TicketsList } from "@/components/tickets/tickets-list";

export default async function TicketsPage() {
  const t = await getTranslations("Tickets.list");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense>
        <TicketsList />
      </Suspense>
    </div>
  );
}
