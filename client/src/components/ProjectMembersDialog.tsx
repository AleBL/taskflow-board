import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, UserMinus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export type ProjectMember = {
  id: number;
  name: string | null;
  email: string | null;
  role: "owner" | "member";
};

export function memberInitials(member: Pick<ProjectMember, "name" | "email">) {
  return (member.name ?? member.email ?? "?").slice(0, 2).toUpperCase();
}

export function memberColor(id: number) {
  return `hsl(${(id * 47) % 360}, 60%, 45%)`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  ownerId: number;
  members: ProjectMember[];
};

export function ProjectMembersDialog({
  open,
  onOpenChange,
  projectId,
  ownerId,
  members,
}: Props) {
  const { t } = useTranslation();
  const { user, isDemo } = useAuth();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const isOwner = user?.id === ownerId;

  const refresh = () => utils.tasks.members.invalidate({ projectId });

  const addMember = trpc.projects.addMember.useMutation({
    onSuccess: () => {
      setEmail("");
      refresh();
      toast.success(t("members.invited"));
    },
    onError: e => {
      const code = e.data?.code;
      toast.error(
        code === "NOT_FOUND"
          ? t("members.userNotFound")
          : code === "CONFLICT"
            ? t("members.alreadyMember")
            : t("common.error")
      );
    },
  });

  const removeMember = trpc.projects.removeMember.useMutation({
    onSuccess: () => {
      refresh();
      utils.tasks.listByProject.invalidate({ projectId });
      toast.success(t("members.removed"));
    },
    onError: () => toast.error(t("common.error")),
  });

  const canInvite = isOwner && !isDemo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("members.title")}</DialogTitle>
          {!isOwner && (
            <DialogDescription>{t("members.ownerOnly")}</DialogDescription>
          )}
        </DialogHeader>

        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {members.map(m => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  className="text-xs text-white"
                  style={{ backgroundColor: memberColor(m.id) }}
                >
                  {memberInitials(m)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {m.name ?? m.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.role === "owner"
                    ? t("members.owner")
                    : t("members.member")}
                </p>
              </div>
              {isOwner && m.id !== ownerId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={t("members.remove")}
                  disabled={removeMember.isPending}
                  onClick={() =>
                    removeMember.mutate({ projectId, userId: m.id })
                  }
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>

        {isOwner && (
          <form
            className="space-y-2 border-t border-border pt-4"
            onSubmit={e => {
              e.preventDefault();
              if (email.trim())
                addMember.mutate({ projectId, email: email.trim() });
            }}
          >
            <Label htmlFor="invite-email">{t("members.inviteLabel")}</Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t("members.invitePlaceholder")}
                disabled={!canInvite}
              />
              <Button
                type="submit"
                disabled={!canInvite || !email.trim() || addMember.isPending}
              >
                {addMember.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {t("members.invite")}
              </Button>
            </div>
            {isDemo && (
              <p className="text-xs text-muted-foreground">
                {t("members.demoDisabled")}
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
