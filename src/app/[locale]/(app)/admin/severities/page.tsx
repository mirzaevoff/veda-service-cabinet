"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/** Раздел переехал — держим старый URL как редирект */
export default function LegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/directories?tab=severities");
  }, [router]);
  return null;
}
