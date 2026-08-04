"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type UserProfile } from "@/lib/api";
import {
  clearSession,
  getAccessToken,
  logout,
  refreshSession,
} from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";

export function UserBar() {
  const t = useTranslations("Home");
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = getAccessToken();
      if (!token) return;
      try {
        const me = await api.me(token);
        if (!cancelled) setUser(me);
      } catch {
        try {
          const tokens = await refreshSession();
          if (!cancelled) setUser(tokens.user);
        } catch {
          clearSession();
          router.replace("/login");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user) return null;

  return (
    <div className="flex items-center gap-3 duration-450 animate-in fade-in">
      <span className="text-sm font-medium">{user.name}</span>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={async () => {
          await logout();
          router.replace("/login");
        }}
      >
        <LogOut data-icon="inline-start" />
        {t("logout")}
      </Button>
    </div>
  );
}
