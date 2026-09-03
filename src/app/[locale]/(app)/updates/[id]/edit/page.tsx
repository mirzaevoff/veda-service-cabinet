"use client";

import { use } from "react";
import { UpdateEditor } from "@/components/release-notes/update-editor";

export default function EditUpdateRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UpdateEditor noteId={id} />;
}
