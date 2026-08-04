"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { version } from "../../../package.json";

export function AppFooter() {
  const [apiVersion, setApiVersion] = useState<string | null>(null);

  useEffect(() => {
    api
      .info()
      .then((info) => setApiVersion(info.version))
      .catch(() => {});
  }, []);

  return (
    <footer className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-0.5 text-xs leading-4 text-muted-foreground/80">
      <span className="tabular-nums">
        v{version}
        {apiVersion && ` · API v${apiVersion}`}
      </span>
      <span>© {new Date().getFullYear()} Veda Vector LLC</span>
    </footer>
  );
}
