import DashboardLayout from "@/components/DashboardLayout";
import { TaskModal } from "@/components/TaskModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Task } from "@/components/TaskCard";
import { useTranslation } from "react-i18next";

const STATUS_CONFIG = {
  todo: { label: "To Do", icon: Circle, color: "text-slate-500" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-amber-500" },
  done: { label: "Done", icon: CheckCircle2, color: "text-emerald-500" },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  high: { label: "High", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
};

export default function TaskSearch() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: projects } = trpc.projects.list.useQuery();

  const queryInput = useMemo(
    () => ({
      search: search || undefined,
      status:
        statusFilter !== "all"
          ? (statusFilter as "todo" | "in_progress" | "done")
          : undefined,
      priority:
        priorityFilter !== "all"
          ? (priorityFilter as "low" | "medium" | "high")
          : undefined,
      projectId:
        projectFilter !== "all" ? parseInt(projectFilter, 10) : undefined,
    }),
    [search, statusFilter, priorityFilter, projectFilter]
  );

  const { data: tasks = [], isLoading } = trpc.tasks.search.useQuery(queryInput);

  const deleteTaskMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.search.invalidate();
      utils.dashboard.metrics.invalidate();
      toast.success(t("common.success"));
    },
    onError: (e) => toast.error(e.message),
  });

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setProjectFilter("all");
  }

  const hasFilters =
    search || statusFilter !== "all" || priorityFilter !== "all" || projectFilter !== "all";

  const projectMap = useMemo(
    () =>
      Object.fromEntries((projects ?? []).map((p) => [p.id, p])),
    [projects]
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">

        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("tasks.searchTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("tasks.searchSubtitle")}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("tasks.searchPlaceholder")}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allStatuses")}</SelectItem>
              <SelectItem value="todo">{t("tasks.statusTodo")}</SelectItem>
              <SelectItem value="in_progress">{t("tasks.statusInProgress")}</SelectItem>
              <SelectItem value="done">{t("tasks.statusDone")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allPriorities")}</SelectItem>
              <SelectItem value="low">{t("tasks.priorityLow")}</SelectItem>
              <SelectItem value="medium">{t("tasks.priorityMedium")}</SelectItem>
              <SelectItem value="high">{t("tasks.priorityHigh")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allProjects")}</SelectItem>
              {projects?.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Search className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">{t("tasks.noTasksFound")}</p>
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? t("tasks.adjustFilters")
                  : t("tasks.createTasksHint")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {tasks.length} {t("tasks.tasksFound")}
            </p>
            {tasks.map((task) => {
              const statusCfg = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
              const priorityCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
              const isOverdue =
                task.dueDate &&
                new Date(task.dueDate) < new Date() &&
                task.status !== "done";
              const project = projectMap[task.projectId];

              return (
                <Card key={task.id} className="group">
                  <CardContent className="flex items-center gap-4 py-3 px-4">
                    <statusCfg.icon
                      className={`h-4 w-4 shrink-0 ${statusCfg.color}`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground truncate">
                          {task.title}
                        </p>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${priorityCfg.className}`}
                        >
                          {priorityCfg.label}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            {t("dashboard.overdue")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {project && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full inline-block"
                              style={{ backgroundColor: project.color }}
                            />
                            {project.name}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingTask(task as Task);
                          setModalOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteTaskMutation.mutate({ id: task.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {editingTask && (
        <TaskModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingTask(null);
            utils.tasks.search.invalidate();
          }}
          projectId={editingTask.projectId}
          task={editingTask}
        />
      )}
    </DashboardLayout>
  );
}
