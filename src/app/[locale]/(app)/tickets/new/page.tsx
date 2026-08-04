import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { CreateTicketFlow } from "@/components/tickets/create-ticket-flow";

export default async function NewTicketPage() {
  const t = await getTranslations("Tickets.create");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} description={t("description")} />
      <CreateTicketFlow />
    </div>
  );
}
