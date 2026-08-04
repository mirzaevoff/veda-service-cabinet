import { TicketChat } from "@/components/tickets/chat/ticket-chat";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="-m-4 flex h-[calc(100%+2rem)] flex-col sm:-m-6 sm:h-[calc(100%+3rem)]">
      <TicketChat ticketId={id} />
    </div>
  );
}
