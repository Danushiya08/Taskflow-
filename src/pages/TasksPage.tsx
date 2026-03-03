import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { Plus, Search, Filter, Calendar, User, Flag, CheckCircle2, Circle, Trash2, AlertCircle } from "lucide-react";

type TaskStatus = "todo" | "in-progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "critical";

const NONE = "__none__";

const normalizeRole = (role: any) => {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "admin";
  if (r === "project-manager" || r === "projectmanager" || r === "project manager" || r === "pm") return "project-manager";
  if (r === "team-member" || r === "teammember" || r === "team member" || r === "member") return "team-member";
  if (r === "client") return "client";
  return r;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "done":
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "in-progress":
      return <Circle className="w-4 h-4 text-blue-600 fill-blue-600" />;
    default:
      return <Circle className="w-4 h-4 text-gray-400" />;
  }
};

const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case "critical":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
};

export function TasksPage() {
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  //Backend summary for progress (total/done/progress)
  const [summary, setSummary] = useState<{ total: number; done: number; progress: number }>({
    total: 0,
    done: 0,
    progress: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | TaskStatus>("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("todo");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAssignedTo, setFormAssignedTo] = useState<string>(NONE);

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const role = normalizeRole(currentUser?.role) as ("admin" | "project-manager" | "team-member" | "client" | undefined);

  const canCreateTask = role === "admin" || role === "project-manager";
  const canDeleteTask = role === "admin" || role === "project-manager";
  const canEditTask = role === "admin" || role === "project-manager";
  const isClient = role === "client";
  const isTeam = role === "team-member";

  const resetCreate = () => {
    setFormTitle("");
    setFormDescription("");
    setFormStatus("todo");
    setFormPriority("medium");
    setFormDueDate("");
    setFormAssignedTo(NONE);
  };

  const loadProjects = async () => {
    const res = await api.get("/projects");
    const list = Array.isArray(res.data?.projects) ? res.data.projects : [];
    setProjects(list.filter((p: any) => p && p._id));
  };

  const loadUsers = async () => {
    //clients + team members don't need users list
    if (!canCreateTask) {
      setUsers([]);
      return;
    }
    const res = await api.get("/users");
    const list = Array.isArray(res.data?.users) ? res.data.users : [];
    setUsers(list.filter((u: any) => u && u._id));
  };

  const loadTasks = async (projectId: string) => {
    if (!projectId) {
      setTasks([]);
      setSummary({ total: 0, done: 0, progress: 0 });
      return;
    }
    setTasksLoading(true);
    try {
      const res = await api.get(`/projects/${projectId}/tasks`);
      const list = Array.isArray(res.data?.tasks) ? res.data.tasks : [];
      setTasks(list);

      //use backend summary for progress
      const s = res.data?.summary;
      if (s && typeof s.progress === "number") {
        setSummary({
          total: Number(s.total) || 0,
          done: Number(s.done) || 0,
          progress: Number(s.progress) || 0,
        });
      } else {
        setSummary({ total: 0, done: 0, progress: 0 });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to load tasks";
      toast.error(msg);
      setTasks([]);
      setSummary({ total: 0, done: 0, progress: 0 });
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([loadProjects(), loadUsers()]);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    loadTasks(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const handleCreateTask = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project first");
      return;
    }
    if (!formTitle.trim()) {
      toast.error("Task title is required");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        status: formStatus,
        priority: formPriority,
        dueDate: formDueDate ? formDueDate : null,
        assignedTo: formAssignedTo === NONE ? null : formAssignedTo,
      };

      const res = await api.post(`/projects/${selectedProjectId}/tasks`, payload);
      toast.success(res.data?.message || "Task created");

      await loadTasks(selectedProjectId);
      setIsCreateOpen(false);
      resetCreate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const updateTask = async (taskId: string, patch: any) => {
    try {
      const res = await api.patch(`/tasks/${taskId}`, patch);
      toast.success(res.data?.message || "Task updated");
      await loadTasks(selectedProjectId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update task");
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const res = await api.delete(`/tasks/${taskId}`);
      toast.success(res.data?.message || "Task deleted");
      await loadTasks(selectedProjectId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete task");
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (t?.title || "").toLowerCase().includes(q) ||
        (t?.description || "").toLowerCase().includes(q) ||
        (t?.assignedTo?.name || "").toLowerCase().includes(q);

      const matchesStatus = filterStatus === "all" || t?.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchQuery, filterStatus]);

  //Your existing card progress (per-task) can remain (optional)
  const derivedProgress = (t: any) => {
    if (typeof t?.progress === "number") return Math.max(0, Math.min(100, t.progress));
    if (t?.status === "done") return 100;
    if (t?.status === "in-progress") return 50;
    return 0;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-3xl text-gray-900">Tasks</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-3xl text-gray-900">Tasks</h1>
        <p className="text-gray-600">No projects available.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Tasks</h1>
          <p className="text-gray-600">
            {isClient
              ? "Client view: project progress + completed tasks (read-only)"
              : isTeam
              ? "Team view: your assigned tasks (read-only)"
              : "Manage tasks for a selected project"}
          </p>
        </div>

        {canCreateTask && (
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        )}
      </div>

      {/*Project Progress (for ALL roles including Client) */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-700">
              Project Progress:{" "}
              <span className="text-gray-900 font-medium">
                {summary.progress}% ({summary.done}/{summary.total} done)
              </span>
            </div>
            <div className="text-xs text-gray-500">Calculated as (Done ÷ Total) × 100</div>
          </div>
          <Progress value={Math.max(0, Math.min(100, summary.progress))} />
        </CardContent>
      </Card>

      {/* Create Task Dialog (Admin/PM only) */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetCreate();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Create a task under the selected project</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Task title" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={(v) => setFormPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Assign To (optional)</Label>
                <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateTask} disabled={creating}>
              {creating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project selector + quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6 space-y-2">
            <div className="text-sm font-medium text-gray-900">Project</div>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500">Tasks refresh automatically when you change the project.</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl text-gray-900 mt-1">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Done</p>
            <p className="text-2xl text-gray-900 mt-1">{summary.done}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Progress</p>
            <p className="text-2xl text-gray-900 mt-1">{summary.progress}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Visible Tasks</p>
            <p className="text-2xl text-gray-900 mt-1">{tasks.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search tasks..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* ✅ Client filter still okay (will effectively only show done from backend) */}
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" onClick={() => loadTasks(selectedProjectId)} disabled={tasksLoading}>
          {tasksLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Tasks List */}
      {tasksLoading ? (
        <div className="text-sm text-gray-500">Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-sm text-gray-500">No tasks found.</div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((t) => (
            <Card key={t._id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(t.status)}
                      <h3 className="text-lg text-gray-900">{t.title}</h3>
                    </div>

                    {t.description ? <p className="text-sm text-gray-600">{t.description}</p> : null}

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Badge variant={getPriorityVariant(t.priority)}>
                        <Flag className="w-3 h-3 mr-1" />
                        {t.priority}
                      </Badge>

                      <Badge variant="secondary">
                        <User className="w-3 h-3 mr-1" />
                        {t?.assignedTo?.name || "Unassigned"}
                      </Badge>

                      {t?.dueDate ? (
                        <Badge variant="outline">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(t.dueDate).toLocaleDateString()}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Task Status Progress</span>
                        <span className="text-gray-900">{derivedProgress(t)}%</span>
                      </div>
                      <Progress value={derivedProgress(t)} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="min-w-[220px] space-y-2">
                    {canEditTask ? (
                      <>
                        <Select value={t.status} onValueChange={(v) => updateTask(t._id, { status: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={t.priority} onValueChange={(v) => updateTask(t._id, { priority: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>

                        {canDeleteTask && (
                          <Button type="button" variant="destructive" onClick={() => deleteTask(t._id)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Read-only. Only Admin/Project Manager can edit tasks.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
