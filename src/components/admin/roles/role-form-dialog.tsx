"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, type PermissionDef, type Role } from "@/lib/api";
import { adminApi } from "@/lib/api-authed";

export function RoleFormDialog({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  /** null — закрыт, "new" — создание, Role — редактирование */
  role: Role | "new" | null;
  permissions: PermissionDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("AdminRoles");
  const isNew = role === "new";
  const editing = role !== null && role !== "new" ? role : null;
  const isAdminRole = editing?.permissions.includes("*") ?? false;
  const nameLocked = editing?.isSystem ?? false;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс формы при открытии
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setChecked(new Set(editing?.permissions ?? []));
    setError(null);
  }, [role, editing]);

  const groups = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      map.set(p.group, [...(map.get(p.group) ?? []), p]);
    }
    return [...map.entries()];
  }, [permissions]);

  async function save() {
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      description: description.trim() || undefined,
      permissions: [...checked],
    };
    try {
      if (isNew) {
        await adminApi.roles.create({ name: name.trim(), ...body });
      } else if (editing) {
        await adminApi.roles.update(editing.id, {
          ...(nameLocked ? {} : { name: name.trim() }),
          ...(isAdminRole ? { description: body.description } : body),
        });
      }
      toast.success(t("saved"));
      if (!isNew) toast(t("instantApply"));
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER301") setError(t("errors.ER301"));
      else if (e instanceof ApiError && e.code === "ER302")
        setError(t("errors.ER302"));
      else setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={role !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? t("createRole") : t("editRole")}</DialogTitle>
          <DialogDescription>
            {isAdminRole ? t("adminReadOnly") : t("formHint")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name" className="text-sm font-medium text-muted-foreground">
              {t("name")}
            </Label>
            <Input
              id="role-name"
              value={name}
              disabled={nameLocked}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              placeholder="support"
            />
            <span className="text-xs text-muted-foreground">
              {nameLocked ? t("systemNameLocked") : t("nameHint")}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-desc" className="text-sm font-medium text-muted-foreground">
              {t("descriptionLabel")}
            </Label>
            <Textarea
              id="role-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {t("permissions")}
            </span>
            {groups.map(([group, defs]) => (
              <div key={group} className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {group}
                </span>
                {defs.map((p) => (
                  <label
                    key={p.key}
                    className="flex cursor-pointer items-center gap-2.5 text-sm"
                  >
                    <Checkbox
                      checked={isAdminRole || checked.has(p.key)}
                      disabled={isAdminRole}
                      onCheckedChange={(value) => {
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (value) next.add(p.key);
                          else next.delete(p.key);
                          return next;
                        });
                      }}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
