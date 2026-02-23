import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Target,
  TrendingUp,
  Calendar,
  Users,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import api from "@/lib/api";
import { ProjectAssistant } from "@/components/ProjectAssistant";

type BackendUser = {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
};

type BackendProject = {
  _id: string;
  name: string;
  status: "planning" | "active" | "on-hold" | "completed";
  priority: "low" | "medium" | "high";
  projectManager?: BackendUser | string | null;
  members?: BackendUser[] | string[];
  budget?: { allocated: number; spent: number };
  progress?: number;
  dueDate?: string | null;
  archived?: boolean;
};

type BackendTask = {
  _id: string;
  projectId: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high" | "critical";
  dueDate?: string | null;
};

type AssistantTask = {
  id: string;
  title: string;
  project: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "in-progress" | "completed";
  dueDate?: string;
  progress?: number;
};

type AssistantProject = {
  id: string;
  name: string;
  status: "on-track" | "at-risk" | "delayed";
  dueDate?: string;
  progress: number;
  tasks: { total: number; completed: number };
  teamCount: number;
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 10);
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

const mapTaskStatus = (s: BackendTask["status"]): AssistantTask["status"] => {
  if (s === "done") return "completed";
  if (s === "in-progress") return "in-progress";
  return "pending";
};

const computeProjectHealth = (p: BackendProject): AssistantProject["status"] => {
  const progress = clamp(Number(p.progress ?? 0));
  const due = p.dueDate ? new Date(p.dueDate) : null;
  const now = new Date();

  if (p.status === "completed" || progress >= 100) return "on-track";
  if (due && due.getTime() < now.getTime() && progress < 100) return "delayed";

  if (due) {
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7 && daysLeft >= 0 && progress < 60) return "at-risk";
  }

  return "on-track";
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical":
      return "bg-red-200 text-red-800 border-red-300";
    case "high":
      return "bg-red-100 text-red-700 border-red-200";
    case "medium":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "low":
      return "bg-blue-100 text-blue-700 border-blue-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "in-progress":
      return "bg-blue-100 text-blue-700";
    case "pending":
      return "bg-gray-100 text-gray-700";
    case "completed":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

export function TeamMemberDashboard() {
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [projectsRaw, setProjectsRaw] = useState<BackendProject[]>([]);
  const [tasksRaw, setTasksRaw] = useState<BackendTask[]>([]);

  // (still mock because you don’t track hours in DB yet)
  const myTasksData = [
    { day: "Mon", hours: 6 },
    { day: "Tue", hours: 7 },
    { day: "Wed", hours: 8 },
    { day: "Thu", hours: 6.5 },
    { day: "Fri", hours: 7.5 },
  ];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrMsg(null);

      try {
        // ✅ Projects route: /projects
        const pRes = await api.get<{ projects: BackendProject[] }>("/projects");
        const projects = pRes.data?.projects ?? [];
        setProjectsRaw(projects);

        // ✅ Tasks routes mounted on /api and supports "/:projectId/tasks"
        const taskCalls = projects.map(async (p) => {
          const tRes = await api.get<{ tasks: BackendTask[] }>(`/${p._id}/tasks`);
          return tRes.data?.tasks ?? [];
        });

        const results = await Promise.all(taskCalls);
        setTasksRaw(results.flat());
      } catch (e: any) {
        setErrMsg(e?.response?.data?.message || e?.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const assistantProjects: AssistantProject[] = useMemo(() => {
    return projectsRaw
      .filter((p) => !p.archived)
      .map((p) => {
        const projectTasks = tasksRaw.filter((t) => String(t.projectId) === String(p._id));
        const total = projectTasks.length;
        const completed = projectTasks.filter((t) => t.status === "done").length;

        return {
          id: p._id,
          name: p.name,
          status: computeProjectHealth(p),
          dueDate: p.dueDate ? formatDate(p.dueDate) : undefined,
          progress: clamp(Number(p.progress ?? 0)),
          tasks: { total, completed },
          teamCount: Array.isArray(p.members) ? p.members.length : 0,
        };
      });
  }, [projectsRaw, tasksRaw]);

  const assistantTasks: AssistantTask[] = useMemo(() => {
    return tasksRaw.map((t) => {
      const projectName = projectsRaw.find((p) => String(p._id) === String(t.projectId))?.name || "Project";

      const progress = t.status === "done" ? 100 : t.status === "in-progress" ? 50 : 0;

      return {
        id: t._id,
        title: t.title,
        project: projectName,
        priority: t.priority,
        status: mapTaskStatus(t.status),
        dueDate: t.dueDate ? formatDate(t.dueDate) : undefined,
        progress,
      };
    });
  }, [tasksRaw, projectsRaw]);

  const stats = useMemo(() => {
    const totalTasks = assistantTasks.length;
    const completed = assistantTasks.filter((t) => t.status === "completed").length;

    const dueSoon = assistantTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      const now = new Date();
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 7 && t.status !== "completed";
    }).length;

    return { totalTasks, completed, dueSoon };
  }, [assistantTasks]);

  const upcomingDeadlines = useMemo(() => {
    return [...assistantTasks]
      .filter((t) => t.status !== "completed" && t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 3);
  }, [assistantTasks]);

  const recentActivity = [
    { action: "Synced data", description: "Projects + assigned tasks loaded from server", time: "Just now" },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl text-gray-900">My Dashboard</h1>
        <p className="text-gray-600">Loading your projects and tasks...</p>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl text-gray-900">My Dashboard</h1>
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">{errMsg}</div>
        <p className="text-sm text-gray-600">
          Confirm backend logs show routes like: <span className="font-mono">GET /projects</span> and{" "}
          <span className="font-mono">GET /api/&lt;projectId&gt;/tasks</span>
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl text-gray-900">My Dashboard</h1>
        <p className="text-gray-600">Track your tasks and productivity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">My Tasks</CardTitle>
            <Target className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{stats.totalTasks}</div>
            <p className="text-xs text-gray-600 mt-1">{stats.dueSoon} due this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Completed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{stats.completed}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-600">Live from server</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Hours This Week</CardTitle>
            <Clock className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">35h</div>
            <p className="text-xs text-gray-600 mt-1">Out of 40h target</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Projects</CardTitle>
            <Users className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{assistantProjects.length}</div>
            <p className="text-xs text-gray-600 mt-1">Active projects</p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ AI Project Assistant */}
      <ProjectAssistant
        role="team-member"
        projects={assistantProjects as any}
        tasks={assistantTasks as any}
        title="AI Project Assistant"
        subtitle="Your daily priorities, risks, reminders, and what to do next"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>My Tasks</CardTitle>
            <CardDescription>Tasks assigned to you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assistantTasks.length === 0 ? (
              <div className="text-sm text-gray-600">No tasks assigned to you yet.</div>
            ) : (
              assistantTasks.map((task) => (
                <div key={task.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-sm text-gray-900 mb-1">{task.title}</h4>
                      <p className="text-xs text-gray-600">{task.project}</p>
                    </div>
                    <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-1 rounded ${getStatusColor(task.status)}`}>
                        {task.status.replace("-", " ")}
                      </span>
                      {task.dueDate ? (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Calendar className="w-3 h-3" />
                          <span>Due {task.dueDate}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">No due date</span>
                      )}
                    </div>

                    {(task.progress ?? 0) > 0 && (
                      <div className="space-y-1">
                        <Progress value={task.progress ?? 0} />
                        <p className="text-xs text-gray-600 text-right">{task.progress ?? 0}% complete</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-600">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Tracking */}
        <Card>
          <CardHeader>
            <CardTitle>Time Tracking</CardTitle>
            <CardDescription>Hours logged this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={myTasksData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>Tasks due soon</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length === 0 ? (
              <div className="text-sm text-gray-600">No upcoming deadlines.</div>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-gray-700" />
                      <div>
                        <p className="text-sm text-gray-900">{t.title}</p>
                        <p className="text-xs text-gray-600">Due {t.dueDate}</p>
                      </div>
                    </div>
                    <Badge className={getPriorityColor(t.priority)}>{t.priority}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
