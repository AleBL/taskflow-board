import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { User, Lock, Loader2 } from "lucide-react";

const nameSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type NameForm = z.infer<typeof nameSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function Profile() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await refresh();
      await utils.auth.me.invalidate();
    },
  });

  const nameForm = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: user?.name ?? "" },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSaveName = async (data: NameForm) => {
    try {
      await updateProfile.mutateAsync({ name: data.name });
      toast.success(t("profile.nameSaved"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const onChangePassword = async (data: PasswordForm) => {
    try {
      await updateProfile.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success(t("profile.passwordChanged"));
      passwordForm.reset();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      if (msg?.includes("incorrect")) {
        toast.error(t("profile.wrongCurrentPassword"));
      } else {
        toast.error(t("common.error"));
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("profile.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("profile.subtitle")}</p>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{t("profile.accountInfo")}</CardTitle>
            </div>
            <CardDescription>{t("profile.accountInfoDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={nameForm.handleSubmit(onSaveName)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input
                  id="email"
                  value={user?.email ?? ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("common.fullName")}</Label>
                <Input
                  id="name"
                  {...nameForm.register("name")}
                  placeholder={t("common.fullName")}
                />
                {nameForm.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {nameForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={updateProfile.isPending}
                className="w-full sm:w-auto"
              >
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t("profile.saveName")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Change Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{t("profile.changePassword")}</CardTitle>
            </div>
            <CardDescription>{t("profile.changePasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">{t("profile.currentPassword")}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  {...passwordForm.register("currentPassword")}
                  placeholder="••••••••"
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  {...passwordForm.register("newPassword")}
                  placeholder={t("auth.passwordPlaceholder")}
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{t("common.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...passwordForm.register("confirmPassword")}
                  placeholder={t("auth.repeatPassword")}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={updateProfile.isPending}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t("profile.updatePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
