"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { UserProfile } from "@/lib/api";
import { usersApi, SessionExpiredError } from "@/lib/api-authed";
import { clearSession, logout } from "@/lib/auth";
import { can as canCheck } from "@/lib/permissions";
import { useRouter } from "@/i18n/navigation";

interface CurrentUserContextValue {
  user: UserProfile | null;
  loading: boolean;
  can: (permission: string) => boolean;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setUser(await usersApi.me());
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        clearSession();
        router.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() асинхронный, setState происходит после await
    void load();
  }, [load]);

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      user,
      loading,
      can: (permission) => canCheck(user, permission),
      reload: load,
      signOut: async () => {
        await logout();
        router.replace("/login");
      },
    }),
    [user, loading, load, router]
  );

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return ctx;
}
