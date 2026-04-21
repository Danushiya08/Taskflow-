import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import {
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  Flag,
  CheckCircle2,
  Circle,
  Trash2,
  AlertCircle,
} from "lucide-react";

import { useUserPreferences } from "@/hooks/useUserPreferences";
import { formatDateByPreference } from "@/lib/dateFormat";
import {
  getPagePaddingClass,
  getCardPaddingClass,
  getGridGapClass,
  getTitleClass,
  getButtonSizeClass,
  getInputSizeClass,
} from "@/lib/uiDensity";

type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done";
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

const getStatusIcon = (status: string, compactMode = false) => {
  const iconClass = compactMode ? "w-3.5 h-3.5" : "w-4 h-4";

  switch (status) {
    case "done":
      return <CheckCircle2 className={`${iconClass} text-green-600`} />;
    case "in-progress":
      return <Circle className={`${iconClass} text-blue-600 fill-blue-600`} />;
    case "review":
      return <Circle className={`${iconClass} text-yellow-600 fill-yellow-600`} />;
    default:
      return <Circle className={`${iconClass} text-muted-foreground`} />;
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

  const { preferences, loadingPreferences } = useUserPreferences();
  const compactMode = preferences.compactMode;

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const role = normalizeRole(currentUser?.role) as
    | "admin"
    | "project-manager"
    | "team-member"
    | "client"
    | undefined;

  const canCreateTask = role === "admin" || role === "project-manager";
  const canDeleteTask = role === "admin" || role === "project-manager";
  const canEditTask = role === "admin" || role === "project-manager";
  const isClient = role === "client";
  const isTeam = role === "team-member";

  const pageClass = `${getPagePaddingClass(compactMode)} bg-background text-foreground`;
  const titleClass = getTitleClass(compactMode);
  const cardTopPaddingClass = getCardPaddingClass(compactMode);
  const gridGapClass = getGridGapClass(compactMode);
  const buttonSizeClass = getButtonSizeClass(compactMode);
  const inputSizeClass = getInputSizeClass(compactMode);

  const subtitleClass = compactMode ? "text-sm text-muted-foreground" : "text-muted-foreground";
  const metricValueClass = compactMode ? "text-xl font-semibold mt-1" : "text-2xl font-semibold mt-1";
  const controlGap = compactMode ? "gap-3" : "gap-4";
  const taskListSpacing = compactMode ? "space-y-2.5" : "space-y-3";
  const taskDescriptionClass = compactMode ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground";
  const taskTitleClass = compactMode
    ? "text-base font-medium text-card-foreground"
    : "text-lg font-medium text-card-foreground";
  const metaBadgeClass = compactMode ? "text-[11px]" : "";
  const progressHeight = compactMode ? "h-2" : "h-3";
  const actionPanelWidth = compactMode ? "min-w-[200px]" : "min-w-[220px]";
  const taskCardInnerSpacing = compactMode ? "space-y-1.5" : "space-y-2";
  const taskMetaMarginTop = compactMode ? "mt-2.5" : "mt-3";
  const taskProgressMarginTop = compactMode ? "mt-3" : "mt-4";
  const dialogFieldSpacing = compactMode ? "space-y-3 py-1" : "space-y-4 py-2";
  const dialogGridGap = compactMode ? "gap-3" : "gap-4";
 
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
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    loadTasks(selectedProjectId);
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
      if (!matchesStatus) return false;

      if (!preferences.showCompletedTasks && t?.status === "done") return false;

      return matchesSearch;
    });
  }, [tasks, searchQuery, filterStatus, preferences.showCompletedTasks]);

  const derivedProgress = (t: any) => {
    if (typeof t?.progress === "number") return Math.max(0, Math.min(100, t.progress));
    if (t?.status === "done") return 100;
    if (t?.status === "review") return 75;
    if (t?.status === "in-progress") return 50;
    if (t?.status === "todo") return 25;
    return 0;
  };

  if (loading || loadingPreferences) {
    return (
      <div className={pageClass}>
        <h1 className={titleClass}>Tasks</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className={pageClass}>
        <h1 className={titleClass}>Tasks</h1>
        <p className="text-muted-foreground">No projects available.</p>
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <div className={`flex items-center justify-between flex-wrap ${controlGap}`}>
        <div>
          <h1 className={titleClass}>Tasks</h1>
          <p className={subtitleClass}>
            {isClient
              ? "Client view: project progress + completed tasks (read-only)"
              : isTeam
              ? "Team view: your assigned tasks (read-only)"
              : "Manage tasks for a selected project"}
          </p>
        </div>

        {canCreateTask && (
          <Button type="button" onClick={() => setIsCreateOpen(true)} className={buttonSizeClass}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        )}
      </div>

      <Card className="border-border bg-card text-card-foreground">
        <CardContent className={`${cardTopPaddingClass} ${compactMode ? "space-y-1.5" : "space-y-2"}`}>
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <div className="text-muted-foreground">
              Project Progress:{" "}
              <span className="text-card-foreground font-medium">
                {summary.progress}% ({summary.done}/{summary.total} done)
              </span>
            </div>
            <div className="text-xs text-muted-foreground">Calculated as (Done ÷ Total) × 100</div>
          </div>
          <Progress value={Math.max(0, Math.min(100, summary.progress))} className={progressHeight} />
        </CardContent>
      </Card>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetCreate();
        }}
      >
        <DialogContent className="max-w-2xl border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Create a task under the selected project</DialogDescription>
          </DialogHeader>

          <div className={dialogFieldSpacing}>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className={inputSizeClass}>
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
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Task title"
                className={inputSizeClass}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={compactMode ? 2 : 3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className={`grid grid-cols-2 ${dialogGridGap}`}>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as TaskStatus)}>
                  <SelectTrigger className={inputSizeClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={(v) => setFormPriority(v as TaskPriority)}>
                  <SelectTrigger className={inputSizeClass}>
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

            <div className={`grid grid-cols-2 ${dialogGridGap}`}>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className={inputSizeClass}
                />
              </div>

              <div className="space-y-2">
                <Label>Assign To (optional)</Label>
                <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                  <SelectTrigger className={inputSizeClass}>
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
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className={buttonSizeClass}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateTask} disabled={creating} className={buttonSizeClass}>
              {creating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={`grid grid-cols-1 lg:grid-cols-5 ${gridGapClass} items-start`}>
        <Card className="lg:col-span-1 border-border bg-card text-card-foreground">
          <CardContent className={`${cardTopPaddingClass} ${compactMode ? "space-y-1.5" : "space-y-2"}`}>
            <div className="text-sm font-medium text-card-foreground">Project</div>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className={inputSizeClass}>
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
            <div className="text-xs text-muted-foreground">
              Tasks refresh automatically when you change the project.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPaddingClass}>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className={metricValueClass}>{summary.total}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPaddingClass}>
            <p className="text-sm text-muted-foreground">Done</p>
            <p className={metricValueClass}>{summary.done}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPaddingClass}>
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className={metricValueClass}>{summary.progress}%</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPaddingClass}>
            <p className="text-sm text-muted-foreground">Visible Tasks</p>
            <p className={metricValueClass}>{filteredTasks.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className={`flex ${controlGap} items-center flex-wrap`}>
        <div className="flex-1 relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tasks..."
            className={`pl-10 ${inputSizeClass}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | TaskStatus)}>
          <SelectTrigger className={`w-48 ${inputSizeClass}`}>
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          onClick={() => loadTasks(selectedProjectId)}
          disabled={tasksLoading}
          className={buttonSizeClass}
        >
          {tasksLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {tasksLoading ? (
        <div className="text-sm text-muted-foreground">Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-sm text-muted-foreground">No tasks found.</div>
      ) : (
        <div className={taskListSpacing}>
          {filteredTasks.map((t) => (
            <Card
              key={t._id}
              className="border-border bg-card text-card-foreground hover:shadow-md transition-shadow"
            >
              <CardContent className={cardTopPaddingClass}>
                <div className={`flex items-start justify-between ${controlGap} flex-col lg:flex-row`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(t.status, compactMode)}
                      <h3 className={taskTitleClass}>{t.title}</h3>
                    </div>

                    {t.description ? <p className={taskDescriptionClass}>{t.description}</p> : null}

                    <div className={`flex flex-wrap items-center gap-2 ${taskMetaMarginTop}`}>
                      <Badge variant={getPriorityVariant(t.priority)} className={metaBadgeClass}>
                        <Flag className="w-3 h-3 mr-1" />
                        {t.priority}
                      </Badge>

                      <Badge variant="secondary" className={metaBadgeClass}>
                        <User className="w-3 h-3 mr-1" />
                        {t?.assignedTo?.name || "Unassigned"}
                      </Badge>

                      {t?.dueDate ? (
                        <Badge variant="outline" className={metaBadgeClass}>
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDateByPreference(
                            t.dueDate,
                            preferences.dateFormat,
                            preferences.timezone
                          )}
                        </Badge>
                      ) : null}
                    </div>

                    <div className={`${taskProgressMarginTop} ${taskCardInnerSpacing}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Task Status Progress</span>
                        <span className="text-card-foreground">{derivedProgress(t)}%</span>
                      </div>
                      <Progress value={derivedProgress(t)} className={progressHeight} />
                    </div>
                  </div>

                  <div className={`${actionPanelWidth} ${taskCardInnerSpacing} w-full lg:w-auto`}>
                    {canEditTask ? (
                      <>
                        <Select value={t.status} onValueChange={(v) => updateTask(t._id, { status: v })}>
                          <SelectTrigger className={inputSizeClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="backlog">Backlog</SelectItem>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={t.priority} onValueChange={(v) => updateTask(t._id, { priority: v })}>
                          <SelectTrigger className={inputSizeClass}>
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
                          <Button type="button" variant="destructive" onClick={() => deleteTask(t._id)} className={buttonSizeClass}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
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