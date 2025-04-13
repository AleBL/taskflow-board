import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  FolderKanban,
  ListTodo,
  Loader2,
  Plus,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

function MetricCard({
  title,
  value,
  icon: Icon,
  color,
  description,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();
  const overdueToastShown = useRef(false);

  // Show a toast when there are overdue tasks (only once per session)
  useEffect(() => {
    if (!overdueToastShown.current && metrics && (metrics.overdue ?? 0) > 0) {
      overdueToastShown.current = true;
      toast.warning(
        `${metrics.overdue} ${t("dashboard.overdue").toLowerCase()}`,
        {
          description: t("dashboard.overdueToastDesc"),
          duration: 6000,
          action: {
            label: t("common.view"),
            onClick: () => navigate("/tasks"),
          },
        }
      );
    }
  }, [metrics, t, navigate]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <Button onClick={() => navigate("/projects")}>
            <Plus className="h-4 w-4 mr-2" />
            {t("projects.newProject")}
          </Button>
        </div>

        {/* Metrics */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <MetricCard
              title={t("projects.title")}
              value={metrics?.totalProjects ?? 0}
              icon={FolderKanban}
              color="bg-violet-500"
            />
            <MetricCard
              title={t("dashboard.totalTasks")}
              value={metrics?.total ?? 0}
              icon={ListTodo}
              color="bg-blue-500"
            />
            <MetricCard
              title={t("dashboard.todo")}
              value={metrics?.todo ?? 0}
              icon={ListTodo}
              color="bg-slate-500"
            />
            <MetricCard
              title={t("dashboard.inProgress")}
              value={metrics?.inProgress ?? 0}
              icon={Clock}
              color="bg-amber-500"
            />
            <MetricCard
              title={t("dashboard.done")}
              value={metrics?.done ?? 0}
              icon={CheckSquare}
              color="bg-emerald-500"
            />
          </div>
        )}

        {/* Overdue alert */}
        {(metrics?.overdue ?? 0) > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  {metrics?.overdue} {t("dashboard.overdue").toLowerCase()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("tasks.adjustFilters")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => navigate("/tasks?status=overdue")}
              >
              {t("projects.viewBoard")}
            </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {t("projects.title")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/projects")}
            >
              {t("common.all")}
            </Button>
          </div>

          {!projects || projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
                <FolderKanban className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">{t("projects.noProjects")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("projects.createFirstProject")}
                  </p>
                </div>
                <Button onClick={() => navigate("/projects")}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("projects.newProject")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.slice(0, 6).map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <CardTitle className="text-base font-semibold truncate">
                        {project.name}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description || t("common.none")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
