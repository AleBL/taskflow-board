import DashboardLayout from "@/components/DashboardLayout";
import { TaskCard, type Task } from "@/components/TaskCard";
import { TaskModal } from "@/components/TaskModal";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Status = "todo" | "in_progress" | "done";

const COLUMNS: { id: Status; labelKey: string; color: string }[] = [
  { id: "todo", labelKey: "tasks.statusTodo", color: "bg-slate-500" },
  { id: "in_progress", labelKey: "tasks.statusInProgress", color: "bg-amber-500" },
  { id: "done", labelKey: "tasks.statusDone", color: "bg-emerald-500" },
];

function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: {
  column: (typeof COLUMNS)[0] & { label: string };
  tasks: Task[];
  onAddTask: (status: Status) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col bg-muted/40 rounded-xl min-w-[280px] w-[280px] shrink-0">

      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
          <span className="font-semibold text-sm text-foreground">
            {column.label}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onAddTask(column.id)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 p-3 space-y-2 min-h-[120px]">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            className="flex items-center justify-center h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => onAddTask(column.id)}
          >
            <p className="text-xs text-muted-foreground">{t("tasks.dropHere")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();

  const utils = trpc.useUtils();

  const { data: project, isLoading: projectLoading } =
    trpc.projects.getById.useQuery({ id: projectId });

  const { data: allTasks = [], isLoading: tasksLoading } =
    trpc.tasks.listByProject.useQuery({ projectId });

  const updateStatusMutation = trpc.tasks.updateStatus.useMutation({
    onError: (e) => {
      toast.error(e.message);
      utils.tasks.listByProject.invalidate({ projectId });
    },
  });

  const deleteTaskMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.listByProject.invalidate({ projectId });
      utils.dashboard.metrics.invalidate();
      toast.success(t("common.success"));
    },
    onError: (e) => toast.error(e.message),
  });

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<Status>("todo");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<Status, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const task of allTasks) {
      const status = task.status as Status;
      if (map[status]) map[status].push(task as Task);
    }
    return map;
  }, [allTasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = allTasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task as Task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id as string | number;

    const overColumn = COLUMNS.find((c) => c.id === overId);
    if (overColumn) {
      const task = allTasks.find((t) => t.id === activeId);
      if (task && task.status !== overColumn.id) {
        utils.tasks.listByProject.setData({ projectId }, (old) =>
          old?.map((t) =>
            t.id === activeId ? { ...t, status: overColumn.id } : t
          )
        );
      }
    }
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as number;
      const overId = over.id as string | number;

      const task = allTasks.find((t) => t.id === activeId);
      if (!task) return;

      let targetStatus: Status = task.status as Status;

      const overColumn = COLUMNS.find((c) => c.id === overId);
      if (overColumn) {
        targetStatus = overColumn.id;
      } else {

        const overTask = allTasks.find((t) => t.id === overId);
        if (overTask) targetStatus = overTask.status as Status;
      }

      if (task.status !== targetStatus) {
        updateStatusMutation.mutate({ id: activeId, status: targetStatus });
      }
    },
    [allTasks, updateStatusMutation]
  );

  function openCreateModal(status: Status) {
    setEditingTask(null);
    setDefaultStatus(status);
    setModalOpen(true);
  }

  function openEditModal(task: Task) {
    setEditingTask(task);
    setModalOpen(true);
  }

  if (projectLoading || tasksLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t("projects.notFound")}</p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => navigate("/projects")}
          >
            {t("projects.backToProjects")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 h-full flex flex-col">

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-4 w-4 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <Button
            className="ml-auto"
            onClick={() => openCreateModal("todo")}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("tasks.addTask")}
          </Button>
        </div>

        <div className="flex-1 overflow-x-auto kanban-scroll pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={{ ...col, label: t(col.labelKey) }}
                  tasks={tasksByStatus[col.id]}
                  onAddTask={openCreateModal}
                  onEditTask={openEditModal}
                  onDeleteTask={(id) => deleteTaskMutation.mutate({ id })}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask && (
                <div className="rotate-2 opacity-90">
                  <TaskCard
                    task={activeTask}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTask(null);
        }}
        projectId={projectId}
        task={editingTask}
      />
    </DashboardLayout>
  );
}
