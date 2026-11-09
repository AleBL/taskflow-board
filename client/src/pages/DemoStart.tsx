import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Kanban, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";

/** `/demo`: creates a throwaway workspace and drops the visitor on a Kanban board. */
export default function DemoStart() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { user, loading } = useAuth();
  const started = useRef(false);

  const startDemo = trpc.auth.startDemo.useMutation({
    onSuccess: async ({ projectId }) => {
      await utils.auth.me.invalidate();
      navigate(`/projects/${projectId}`, { replace: true });
    },
  });

  const start = useCallback(() => {
    startDemo.mutate({
      locale: i18n.resolvedLanguage === "pt-BR" ? "pt-BR" : "en",
      tzOffsetMinutes: new Date().getTimezoneOffset(),
    });
  }, [i18n.resolvedLanguage, startDemo]);

  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;
    if (user) {
      navigate("/dashboard", { replace: true });
      return;
    }
    start();
  }, [loading, user, navigate, start]);

  const failed = startDemo.isError;
  const errorMessage =
    startDemo.error?.data?.code === "TOO_MANY_REQUESTS"
      ? t("errors.tooManyRequests")
      : t("demo.failed");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          {failed ? (
            <Kanban className="h-7 w-7 text-primary" />
          ) : (
            <Loader2 className="h-7 w-7 text-primary animate-spin" />
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            {failed ? errorMessage : t("demo.preparing")}
          </h1>
          {!failed && (
            <p className="text-sm text-muted-foreground">
              {t("demo.preparingHint")}
            </p>
          )}
        </div>
        {failed && (
          <div className="flex gap-3">
            <Button onClick={start} disabled={startDemo.isPending}>
              {t("demo.retry")}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">{t("demo.backHome")}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
