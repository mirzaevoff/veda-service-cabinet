"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BriefcaseBusiness, ChevronDown, MailPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PhoneInput } from "@/components/auth/phone-input";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type {
  EntityInvite,
  EntityMemberRole,
  LegalEntityMember,
  Position,
} from "@/lib/api";
import { ApiError } from "@/lib/api";
import { checklistsApi, legalEntitiesApi } from "@/lib/api-authed";
import { fullName } from "@/lib/format";

function RoleBadge({ role }: { role: EntityMemberRole }) {
  const t = useTranslations("LegalEntities.members");
  return (
    <Badge
      variant="secondary"
      className={
        role === "owner"
          ? "bg-accent-light text-primary"
          : "bg-secondary text-muted-foreground"
      }
    >
      {t(role)}
    </Badge>
  );
}

/**
 * Участники ЮЛ и инвайты по номеру — для owner'ов (свои организации)
 * и staff (drawer справочника).
 */
export function MembersManager({
  entityId,
  members,
  onChanged,
}: {
  entityId: string;
  members: LegalEntityMember[];
  onChanged: () => void;
}) {
  const t = useTranslations("LegalEntities.members");
  const { user } = useCurrentUser();

  const [invites, setInvites] = useState<EntityInvite[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [digits, setDigits] = useState("");
  const [inviteRole, setInviteRole] = useState<EntityMemberRole>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadInvites = useCallback(() => {
    legalEntitiesApi
      .invites(entityId)
      .then(setInvites)
      .catch(() => setInvites([]));
    checklistsApi.positions
      .list(entityId)
      .then((list) => setPositions(list.filter((p) => !p.archived)))
      .catch(() => setPositions([]));
  }, [entityId]);

  useEffect(reloadInvites, [reloadInvites]);

  async function togglePosition(member: LegalEntityMember, positionId: string) {
    const next = member.positions.includes(positionId)
      ? member.positions.filter((id) => id !== positionId)
      : [...member.positions, positionId];
    setBusy(true);
    try {
      await checklistsApi.positions.setMemberPositions(entityId, member.id, next);
      onChanged();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    if (digits.length !== 9) {
      setError(t("invalidPhone"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { result } = await legalEntitiesApi.invite(entityId, {
        phone: `+998${digits}`,
        role: inviteRole,
      });
      setDigits("");
      if (result === "added") {
        toast.success(t("inviteAdded"));
        onChanged();
      } else {
        toast.success(t("inviteSent"));
        reloadInvites();
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER805") setError(t("errors.ER805"));
      else if (e instanceof ApiError && e.code === "ER806")
        setError(t("errors.ER806"));
      else setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function setRole(member: LegalEntityMember, role: EntityMemberRole) {
    if (member.role === role) return;
    setBusy(true);
    try {
      await legalEntitiesApi.updateMemberRole(entityId, member.id, role);
      toast.success(t("roleChanged"));
      onChanged();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(member: LegalEntityMember) {
    setBusy(true);
    try {
      await legalEntitiesApi.revokeAccess(entityId, member.id);
      toast.success(t("removed"));
      onChanged();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(invite: EntityInvite) {
    setBusy(true);
    try {
      await legalEntitiesApi.revokeInvite(entityId, invite.id);
      reloadInvites();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium text-muted-foreground">
        {t("title")}
      </Label>

      {members.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-semibold text-primary">
                {member.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 truncate text-sm font-medium">
                  {fullName(member)}
                  <RoleBadge role={member.role} />
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {member.phone}
                  {member.positions.length > 0 && (
                    <>
                      {" · "}
                      {member.positions
                        .map((id) => positions.find((p) => p.id === id)?.title)
                        .filter(Boolean)
                        .join(", ")}
                    </>
                  )}
                </span>
              </div>
              {positions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        aria-label={t("positionsLabel")}
                        className="text-muted-foreground"
                      >
                        <BriefcaseBusiness className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    {positions.map((position) => (
                      <DropdownMenuItem
                        key={position.id}
                        closeOnClick={false}
                        onClick={() => togglePosition(member, position.id)}
                      >
                        <span
                          className={
                            member.positions.includes(position.id)
                              ? "font-medium text-primary"
                              : undefined
                          }
                        >
                          {position.title}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {member.id !== user?.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busy}
                          aria-label={t("changeRole")}
                          className="text-muted-foreground"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setRole(member, "member")}>
                        {t("makeMember")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRole(member, "owner")}>
                        {t("makeOwner")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label={t("remove")}
                    onClick={() => remove(member)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      )}

      {invites.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t("pendingInvites")}
          </span>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-2"
            >
              <MailPlus className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm tabular-nums">
                  {invite.phone}
                  <RoleBadge role={invite.role} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("inviteHint")}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                aria-label={t("revokeInvite")}
                onClick={() => revokeInvite(invite)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void invite();
        }}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <PhoneInput
              value={digits}
              onChange={(v) => {
                setDigits(v);
                setError(null);
              }}
              invalid={!!error}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="h-[54px] gap-1.5 whitespace-nowrap">
                  {t(inviteRole)}
                  <ChevronDown className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setInviteRole("member")}>
                {t("member")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInviteRole("owner")}>
                {t("owner")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="submit"
            disabled={busy || digits.length !== 9}
            className="h-[54px]"
          >
            {busy ? <Spinner className="size-4" /> : t("invite")}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    </div>
  );
}
