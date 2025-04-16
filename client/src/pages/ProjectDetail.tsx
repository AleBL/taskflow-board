import DashboardLayout from "@/components/DashboardLayout";
import { TaskCard, type Task } from "@/components/TaskCard";
import { TaskModal } from "@/components/TaskModal";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, Loader2, Plus, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;

  const intersections = rectIntersection(args);
  if (intersections.length > 0) return intersections;

  return closestCorners(args);
};

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
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { status: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full flex-col rounded-xl bg-muted/40 min-w-[280px] w-[280px] shrink-0 transition-colors ${
        isOver ? "bg-primary/5" : ""
      }`}
    >
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

      <div className="flex-1 p-3 space-y-2 min-h-[220px]">
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

  const { data: members = [] } =
    trpc.tasks.members.useQuery({ projectId }, { enabled: !!projectId });

  const { data: allTasks = [], isLoading: tasksLoading } =
    trpc.tasks.listByProject.useQuery({ projectId });

  const updateStatusMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.listByProject.invalidate({ projectId });
      utils.dashboard.metrics.invalidate();
    },
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [defaultStatus, setDefaultStatus] = useState<Status>("todo");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
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
    const { over } = event;
    if (!over) return;
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as number;
      const overId = over.id;

      const draggedTask = allTasks.find((t) => t.id === activeId);
      if (!draggedTask) return;

      let newStatus: Status | null = null;

      const targetTask = allTasks.find((t) => t.id === overId);
      if (targetTask) {
        newStatus = targetTask.status;
      } else {
        const targetColumn = COLUMNS.find((c) => c.id === overId);
        if (targetColumn) {
          newStatus = targetColumn.id;
        }
      }

      if (newStatus && draggedTask.status !== newStatus) {
        updateStatusMutation.mutate({ id: activeId, status: newStatus });
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
          <div className="ml-auto flex items-center gap-3">
            {members.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map((m) => (
                    <Tooltip key={m.id}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-7 w-7 border-2 border-background cursor-default">
                          <AvatarFallback className="text-xs" style={{ backgroundColor: `hsl(${(m.id * 47) % 360}, 60%, 45%)`, color: "white" }}>
                            {(m.name ?? m.email ?? "?").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{m.name ?? m.email}</TooltipContent>
                    </Tooltip>
                  ))}
                  {members.length > 5 && (
                    <Avatar className="h-7 w-7 border-2 border-background">
                      <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                        +{members.length - 5}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            )}
            <Button onClick={() => openCreateModal("todo")}>
              <Plus className="h-4 w-4 mr-2" />
              {t("tasks.addTask")}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto kanban-scroll pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
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
