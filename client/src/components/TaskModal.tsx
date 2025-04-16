import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Task } from "./TaskCard";
import { useTranslation } from "react-i18next";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: number;
  task?: Task | null;
};

type TaskForm = {
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string;
  assigneeId: string;
};

const defaultForm: TaskForm = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  assigneeId: "none",
};

export function TaskModal({ open, onClose, projectId, task }: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<TaskForm>(() =>
    task
      ? {
          title: task.title,
          description: task.description ?? "",
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate
            ? new Date(task.dueDate).toISOString().split("T")[0]
            : "",
          assigneeId: task.assigneeId ? String(task.assigneeId) : "none",
        }
      : defaultForm
  );

  const [comment, setComment] = useState("");

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate
          ? new Date(task.dueDate).toISOString().split("T")[0]
          : "",
        assigneeId: task.assigneeId ? String(task.assigneeId) : "none",
      });
    } else if (open) {
      setForm(defaultForm);
    }
  }, [task, open]);

  const { data: members } = trpc.users.list.useQuery(
    undefined,
    { enabled: open }
  );

  const { data: comments } = trpc.comments.listByTask.useQuery(
    { taskId: task?.id ?? 0 },
    { enabled: !!task?.id }
  );

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.listByProject.invalidate({ projectId });
      utils.dashboard.metrics.invalidate();
      onClose();
      toast.success(t("common.success"));
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.listByProject.invalidate({ projectId });
      onClose();
      toast.success(t("common.success"));
    },
    onError: (e) => toast.error(e.message),
  });

  const addCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.comments.listByTask.invalidate({ taskId: task?.id });
      setComment("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.listByTask.invalidate({ taskId: task?.id });
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    const assigneeId =
      form.assigneeId && form.assigneeId !== "none"
        ? parseInt(form.assigneeId, 10)
        : null;

    const payload = {
      title: form.title,
      description: form.description || undefined,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate ? new Date(form.dueDate).getTime() : null,
      assigneeId,
    };

    if (task) {
      updateMutation.mutate({ id: task.id, ...payload });
    } else {
      createMutation.mutate({ ...payload, projectId });
    }
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !task) return;
    addCommentMutation.mutate({ taskId: task.id, content: comment });
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? t("tasks.editTask") : t("tasks.createTask")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">{t("tasks.taskTitle")} *</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t("tasks.taskTitlePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">{t("projects.projectDescription")}</Label>
            <Textarea
              id="task-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("tasks.descriptionPlaceholder")}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("tasks.status")}</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as TaskForm["status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">{t("tasks.statusTodo")}</SelectItem>
                  <SelectItem value="in_progress">{t("tasks.statusInProgress")}</SelectItem>
                  <SelectItem value="done">{t("tasks.statusDone")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("tasks.priority")}</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  setForm({ ...form, priority: v as TaskForm["priority"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("tasks.priorities.low")}</SelectItem>
                  <SelectItem value="medium">{t("tasks.priorities.medium")}</SelectItem>
                  <SelectItem value="high">{t("tasks.priorities.high")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("tasks.assignee")}</Label>
            <Select
              value={form.assigneeId}
              onValueChange={(v) => setForm({ ...form, assigneeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("tasks.unassigned")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("tasks.unassigned")}</SelectItem>
                {members?.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name ?? m.email ?? `User #${m.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">{t("tasks.dueDate")}</Label>
            <Input
              id="due-date"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {task ? t("common.save") : t("tasks.createTask")}
            </Button>
          </DialogFooter>
        </form>

        {task && (
          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("tasks.comments")} ({comments?.length ?? 0})
            </h3>

            <div className="space-y-3 max-h-48 overflow-y-auto">
              {comments?.map((c) => (
                <div key={c.id} className="flex gap-2 group">
                  <div className="flex-1 bg-muted rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-foreground mb-1">
                      {c.authorName ?? "Unknown"}
                    </p>
                    <p className="text-sm text-foreground">{c.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(c.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteCommentMutation.mutate({ id: c.id })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {comments?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t("tasks.noComments")}
                </p>
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("tasks.addComment")}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!comment.trim() || addCommentMutation.isPending}
              >
                {addCommentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
