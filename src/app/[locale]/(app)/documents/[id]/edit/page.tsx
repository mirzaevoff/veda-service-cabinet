"use client";

import { use } from "react";
import { DocumentEditor } from "@/components/documents/document-editor";

export default function EditDocumentRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DocumentEditor documentId={id} />;
}
