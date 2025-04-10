import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Loader2, LayoutDashboard, CheckSquare, Kanban } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const features = [
    {
      icon: <Kanban className="h-5 w-5 text-primary" />,
      title: t("home.features.kanban.title"),
      desc: t("home.features.kanban.desc"),
    },
    {
      icon: <CheckSquare className="h-5 w-5 text-primary" />,
      title: t("home.features.tracking.title"),
      desc: t("home.features.tracking.desc"),
    },
    {
      icon: <LayoutDashboard className="h-5 w-5 text-primary" />,
      title: t("home.features.dashboard.title"),
      desc: t("home.features.dashboard.desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Kanban className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg text-foreground">TaskFlow</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button asChild>
            <Link href="/login">{t("auth.signIn")}</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
            <Kanban className="h-4 w-4" />
            {t("home.tagline")}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight">
            {t("home.headline")}<br />
            <span className="text-primary">{t("home.headlineAccent")}</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            {t("home.subheadline")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" asChild>
            <Link href="/register">{t("home.getStartedFree")}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">{t("auth.signIn")}</Link>
          </Button>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full mt-8">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-card border border-border rounded-xl p-5 text-left space-y-2"
            >
              {f.icon}
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
