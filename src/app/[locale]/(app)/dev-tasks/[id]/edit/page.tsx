"use client";

import { use } from "react";
import { DevTaskEditor } from "@/components/dev-tasks/dev-task-editor";

export default function EditDevTaskRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DevTaskEditor taskId={id} />;
}
