"use client";

import { useTranslations } from "next-intl";
import { LogOut, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { Link } from "@/i18n/navigation";

export function UserMenu() {
  const t = useTranslations("Shell");
  const { user, signOut } = useCurrentUser();

  if (!user) return null;

  const initial = user.name.trim().charAt(0).toUpperCase() || "•";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="gap-2 px-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent-light text-sm font-semibold text-primary">
              {initial}
            </span>
            <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
              {user.name}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="flex flex-col gap-1 px-3 py-2">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="text-xs text-muted-foreground">{user.phone}</span>
          <Badge variant="secondary" className="mt-1 w-fit">
            {user.role.name}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        <Link href="/profile">
          <DropdownMenuItem>
            <UserRound className="size-4" />
            {t("profile")}
          </DropdownMenuItem>
        </Link>
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut className="size-4" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
