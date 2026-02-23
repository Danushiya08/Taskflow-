import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Calendar, Paperclip, MessageSquare, MoreVertical, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";

type Project = { _id: string; name: string };

type Task = {
  _id: string;
  title: string;
  status?: string; // backlog/todo/in-progress/review/done (or other values)
  priority?: string;
  dueDate?: string;
  tags?: string[];
  assignee?: { name?: string; avatar?: string };
  commentsCount?: number;
  attachmentsCount?: number;
  projectId?: string;
};

export function KanbanPage() {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const columns = [
    { id: "backlog", title: "Backlog", color: "bg-gray-100" },
    { id: "todo", title: "To Do", color: "bg-blue-100" },
    { id: "in-progress", title: "In Progress", color: "bg-yellow-100" },
    { id: "review", title: "Review", color: "bg-purple-100" },
    { id: "done", title: "Done", color: "bg-green-100" },
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
    setProjects(res.data.projects || []);
  };

  const loadTasksForProject = async (projectId: string) => {
    const res = await api.get<{ tasks: Task[] }>(`/projects/${projectId}/tasks`);
    return res.data.tasks || [];
  };

  const loadAllTasks = async () => {
    try {
      setLoading(true);
      await loadProjects();

      // If "all", fetch tasks for all projects
      if (selectedProject === "all") {
        const pRes = await api.get<{ projects: Project[] }>("/projects");
        const plist = pRes.data.projects || [];

        const chunks = await Promise.all(
          plist.map(async (p) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

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

    // Update UI optimistically
    setAllTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: targetColumn } : t))
    );

    toast.success(`Task moved to ${targetColumn.replace("-", " ")}`);

    // If you have an endpoint to update status, enable this:
    // await api.patch(`/tasks/${taskId}`, { status: targetColumn });
  };

  const getPriorityColor = (priority?: string) => {
    const p = String(priority || "").toLowerCase();
    if (p === "critical") return "destructive";
    if (p === "high") return "default";
    if (p === "medium") return "secondary";
    return "outline";
  };

  const totalTasks = Object.values(tasksByColumn).reduce((sum, col) => sum + col.length, 0);
  const doneCount = tasksByColumn.done.length;

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Kanban Board</h1>
          <p className="text-gray-600">Drag and drop tasks to update their status</p>
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

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {columns.map((column) => {
          const count = tasksByColumn[column.id]?.length || 0;
          return (
            <Card key={column.id}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500">{column.title}</p>
                  <p className="text-2xl text-gray-900 mt-1">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div key={column.id} className="flex-1 min-w-80 flex flex-col">
            <div className={`${column.color} p-3 rounded-t-lg border-b-2 border-gray-300`}>
              <div className="flex items-center justify-between">
                <h3 className="text-gray-900">
                  {column.title}
                  <span className="ml-2 text-sm text-gray-600">({tasksByColumn[column.id]?.length || 0})</span>
                </h3>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div
              className="flex-1 bg-gray-50 p-3 space-y-3 overflow-y-auto rounded-b-lg"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {loading ? (
                <div className="text-sm text-gray-600">Loading tasks...</div>
              ) : (tasksByColumn[column.id] || []).length === 0 ? (
                <div className="text-sm text-gray-500">No tasks</div>
              ) : (
                tasksByColumn[column.id].map((task) => (
                  <Card
                    key={task._id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task._id, column.id)}
                    className="cursor-move hover:shadow-lg transition-shadow bg-white"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <h4 className="text-sm text-gray-900 flex-1">{task.title}</h4>
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

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-3 text-xs text-gray-600">
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
                            <AvatarImage src={task.assignee?.avatar || ""} />
                            <AvatarFallback>{(task.assignee?.name || "U")[0]}</AvatarFallback>
                          </Avatar>
                        </div>

                        {task.dueDate ? (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            {task.dueDate}
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom stats */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-600">
          Total Tasks: <span className="text-gray-900">{totalTasks}</span>
        </div>
        <div className="text-sm text-gray-600">
          Completion Rate: <span className="text-gray-900">{totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0}%</span>
        </div>
      </div>
    </div>
  );
}
