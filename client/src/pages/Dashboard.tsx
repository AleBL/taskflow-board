import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
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
  const [, navigate] = useLocation();
  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Overview of your projects and tasks
            </p>
          </div>
          <Button onClick={() => navigate("/projects")}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
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
              title="Total Projects"
              value={metrics?.totalProjects ?? 0}
              icon={FolderKanban}
              color="bg-violet-500"
              description="Active projects"
            />
            <MetricCard
              title="Total Tasks"
              value={metrics?.total ?? 0}
              icon={ListTodo}
              color="bg-blue-500"
              description="Across all projects"
            />
            <MetricCard
              title="To Do"
              value={metrics?.todo ?? 0}
              icon={ListTodo}
              color="bg-slate-500"
              description="Not started yet"
            />
            <MetricCard
              title="In Progress"
              value={metrics?.inProgress ?? 0}
              icon={Clock}
              color="bg-amber-500"
              description="Currently active"
            />
            <MetricCard
              title="Done"
              value={metrics?.done ?? 0}
              icon={CheckSquare}
              color="bg-emerald-500"
              description="Completed tasks"
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
                  {metrics?.overdue} overdue{" "}
                  {metrics?.overdue === 1 ? "task" : "tasks"}
                </p>
                <p className="text-sm text-muted-foreground">
                  These tasks have passed their due date and are not yet done.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => navigate("/tasks?status=overdue")}
              >
                View tasks
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Recent Projects
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/projects")}
            >
              View all
            </Button>
          </div>

          {!projects || projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
                <FolderKanban className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">No projects yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create your first project to get started
                  </p>
                </div>
                <Button onClick={() => navigate("/projects")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
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
                      {project.description || "No description"}
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
