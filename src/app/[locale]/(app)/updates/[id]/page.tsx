"use client";

import { use } from "react";
import { UpdateView } from "@/components/release-notes/update-view";

export default function UpdateRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UpdateView noteId={id} />;
}
