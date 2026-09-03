"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { UpdatesFeed } from "@/components/release-notes/updates-feed";

export default function UpdatesPage() {
  const t = useTranslations("Updates");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <UpdatesFeed />
    </div>
  );
}
