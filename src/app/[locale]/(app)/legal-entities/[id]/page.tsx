"use client";

import { use } from "react";
import { EntityPage } from "@/components/legal-entities/entity-page";

/** Карточка юрлица */
export default function LegalEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <EntityPage entityId={id} />;
}
