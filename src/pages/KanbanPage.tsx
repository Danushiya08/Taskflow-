import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  Calendar,
  Paperclip,
  MessageSquare,
  MoreVertical,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { formatDateByPreference } from "@/lib/dateFormat";

type Project = { _id: string; name: string };

type Task = {
  _id: string;
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  tags?: string[];
  assignee?: { name?: string; avatar?: string };
  assignedTo?: { name?: string; avatar?: string };
  commentsCount?: number;
  attachmentsCount?: number;
  projectId?: string;
};

const COLUMN_STYLES: Record<string, string> = {
  backlog: "bg-muted",
  todo: "bg-blue-500/10",
  "in-progress": "bg-yellow-500/10",
  review: "bg-purple-500/10",
  done: "bg-green-500/10",
};

export function KanbanPage() {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const { preferences, loadingPreferences } = useUserPreferences();

  const columns = [
    { id: "backlog", title: "Backlog" },
    { id: "todo", title: "To Do" },
    { id: "in-progress", title: "In Progress" },
    { id: "review", title: "Review" },
    { id: "done", title: "Done" },
  ];

  const normalizeStatus = (s?: string) => {
    const v = String(s || "").toLowerCase().trim();
    if (["backlog"].includes(v)) return "backlog";
    if (["todo", "to do"].includes(v)) return "todo";
    if (["in-progress", "in progress", "progress"].includes(v)) return "in-progress";
    if (["review"].includes(v)) return "review";
    if (["done", "completed", "complete"].includes(v)) return "done";
    return "backlog";
  };

  const loadProjects = async () => {
    const res = await api.get<{ projects: Project[] }>("/projects");
    const projectList = res.data.projects || [];
    setProjects(projectList);
    return projectList;
  };

  const loadTasksForProject = async (projectId: string) => {
    const res = await api.get<{ tasks: Task[] }>(`/projects/${projectId}/tasks`);
    return res.data.tasks || [];
  };

  const loadAllTasks = async () => {
    try {
      setLoading(true);

      const projectList = await loadProjects();

      if (selectedProject === "all") {
        const chunks = await Promise.all(
          projectList.map(async (p) => {
            try {
              const tasks = await loadTasksForProject(p._id);
              return tasks.map((t) => ({ ...t, projectId: p._id }));
            } catch {
              return [];
            }
          })
        );

        setAllTasks(chunks.flat());
      } else {
        const tasks = await loadTasksForProject(selectedProject);
        setAllTasks(tasks.map((t) => ({ ...t, projectId: selectedProject })));
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to load kanban tasks");
      setAllTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTasks();
  }, [selectedProject]);

  const visibleColumns = useMemo(() => {
    return preferences.showCompletedTasks
      ? columns
      : columns.filter((column) => column.id !== "done");
  }, [preferences.showCompletedTasks]);

  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      backlog: [],
      todo: [],
      "in-progress": [],
      review: [],
      done: [],
    };

    for (const t of allTasks) {
      const col = normalizeStatus(t.status);
      grouped[col].push(t);
    }

    return grouped;
  }, [allTasks]);

  const handleDragStart = (e: React.DragEvent, taskId: string, columnId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.setData("sourceColumn", columnId);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();

    const taskId = e.dataTransfer.getData("taskId");
    const sourceColumn = e.dataTransfer.getData("sourceColumn");

    if (!taskId || !sourceColumn || sourceColumn === targetColumn) return;

    setAllTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: targetColumn } : t))
    );

    try {
      await api.patch(`/tasks/${taskId}`, { status: targetColumn });
      toast.success(`Task moved to ${targetColumn.replace("-", " ")}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update task status");
      await loadAllTasks();
    }
  };

  const getPriorityColor = (priority?: string) => {
    const p = String(priority || "").toLowerCase();
    if (p === "critical") return "destructive";
    if (p === "high") return "default";
    if (p === "medium") return "secondary";
    return "outline";
  };

  const totalTasks = visibleColumns.reduce(
    (sum, column) => sum + (tasksByColumn[column.id]?.length || 0),
    0
  );

  const doneCount = tasksByColumn.done.length;

  return (
    <div className="p-6 space-y-6 h-full flex flex-col bg-background text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Kanban Board</h1>
          <p className="text-muted-foreground">Drag and drop tasks to update their status</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`grid gap-4 ${visibleColumns.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {visibleColumns.map((column) => {
          const count = tasksByColumn[column.id]?.length || 0;

          return (
            <Card key={column.id} className="border-border bg-card text-card-foreground">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{column.title}</p>
                  <p className="text-2xl font-semibold mt-1">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {visibleColumns.map((column) => (
          <div key={column.id} className="flex-1 min-w-80 flex flex-col">
            <div className={`${COLUMN_STYLES[column.id]} p-3 rounded-t-lg border-b border-border`}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">
                  {column.title}
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({tasksByColumn[column.id]?.length || 0})
                  </span>
                </h3>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div
              className="flex-1 bg-muted/40 p-3 space-y-3 overflow-y-auto rounded-b-lg border-x border-b border-border"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {loading || loadingPreferences ? (
                <div className="text-sm text-muted-foreground">Loading tasks...</div>
              ) : (tasksByColumn[column.id] || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No tasks</div>
              ) : (
                tasksByColumn[column.id].map((task) => {
                  const assignee = task.assignee || task.assignedTo;
                  const displayName = assignee?.name || "U";

                  return (
                    <Card
                      key={task._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task._id, column.id)}
                      className="cursor-move hover:shadow-lg transition-shadow border-border bg-card text-card-foreground"
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium text-card-foreground flex-1">
                              {task.title}
                            </h4>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                              {task.priority || "priority"}
                            </Badge>
                            {(task.tags || []).map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-border">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {task.commentsCount || 0}
                              </div>
                              <div className="flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />
                                {task.attachmentsCount || 0}
                              </div>
                            </div>

                            <Avatar className="h-6 w-6">
                              <AvatarImage src={assignee?.avatar || ""} />
                              <AvatarFallback>{displayName[0]}</AvatarFallback>
                            </Avatar>
                          </div>

                          {task.dueDate ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {formatDateByPreference(task.dueDate, preferences.dateFormat)}
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between bg-card p-4 rounded-lg border border-border text-card-foreground">
        <div className="text-sm text-muted-foreground">
          Total Tasks: <span className="text-card-foreground font-medium">{totalTasks}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Completion Rate:{" "}
          <span className="text-card-foreground font-medium">
            {totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}