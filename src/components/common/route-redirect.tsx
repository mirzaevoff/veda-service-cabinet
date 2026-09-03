"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/** Мгновенный клиентский редирект — для старых маршрутов, переехавших в хабы */
export function RouteRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return null;
}
