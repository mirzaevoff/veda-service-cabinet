"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ReleaseArea } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Бейдж области новости + версия(и) релиза */
export function AreaBadge({
  area,
  frontVersion,
  apiVersion,
}: {
  area: ReleaseArea;
  frontVersion?: string;
  apiVersion?: string;
}) {
  const t = useTranslations("Updates");
  const version =
    area === "api"
      ? apiVersion
      : area === "both"
        ? [frontVersion, apiVersion].filter(Boolean).join(" / ")
        : frontVersion;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant="secondary"
        className={cn(
          area === "frontend" && "bg-accent-light text-primary",
          area === "api" && "bg-secondary text-muted-foreground",
          area === "both" && "bg-accent-light text-primary"
        )}
      >
        {t(`area.${area}`)}
      </Badge>
      {version && <span className="tabular-nums">v{version}</span>}
    </span>
  );
}
