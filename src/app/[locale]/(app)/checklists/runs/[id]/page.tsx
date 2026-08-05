import { RunView } from "@/components/checklists/run-view";

export default async function ChecklistRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl">
      <RunView runId={id} />
    </div>
  );
}
