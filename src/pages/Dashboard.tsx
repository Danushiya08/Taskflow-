import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock, Users, FolderKanban, Target, CheckCircle2 } from "lucide-react";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import api from "@/lib/api";
import { ProjectAssistant } from "@/components/ProjectAssistant";
import type { Project, Task } from "@/components/ProjectAssistant";

type BackendProject = {
  _id: string;
  name: string;
  status: "planning" | "active" | "on-hold" | "completed";
  progress?: number;
  dueDate?: string | null;
  members?: any[];
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

const formatDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 10);
};

const toHealthStatus = (p: BackendProject): Project["status"] => {
  const progress = Math.max(0, Math.min(100, Number(p.progress ?? 0)));
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

const mapTaskStatus = (s: BackendTask["status"]): Task["status"] => {
  if (s === "done") return "completed";
  if (s === "in-progress") return "in-progress";
  return "pending";
};

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [projectsRaw, setProjectsRaw] = useState<BackendProject[]>([]);
  const [tasksRaw, setTasksRaw] = useState<BackendTask[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrMsg(null);

      try {
        const pRes = await api.get<{ projects: BackendProject[] }>("/projects");
        const projects = (pRes.data?.projects ?? []).filter((p) => !p.archived);
        setProjectsRaw(projects);

        const taskCalls = projects.map(async (p) => {
          const tRes = await api.get<{ tasks: BackendTask[] }>(`/${p._id}/tasks`);
          return tRes.data?.tasks ?? [];
        });

        const results = await Promise.all(taskCalls);
        setTasksRaw(results.flat());
      } catch (e: any) {
        setErrMsg(e?.response?.data?.message || e?.message || "Failed to load admin dashboard");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const recentProjects: Project[] = useMemo(() => {
    return projectsRaw.slice(0, 10).map((p) => {
      const projectTasks = tasksRaw.filter((t) => String(t.projectId) === String(p._id));
      const total = projectTasks.length;
      const completed = projectTasks.filter((t) => t.status === "done").length;

      return {
        id: p._id,
        name: p.name,
        progress: Math.max(0, Math.min(100, Number(p.progress ?? 0))),
        status: toHealthStatus(p),
        dueDate: p.dueDate ? formatDate(p.dueDate) : undefined,
        tasks: { total, completed },
        teamCount: Array.isArray(p.members) ? p.members.length : 0,
      };
    });
  }, [projectsRaw, tasksRaw]);

  const allTasks: Task[] = useMemo(() => {
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

  const productivityData = useMemo(() => {
    // simple chart: count tasks by status as a weekly-ish placeholder
    const todo = allTasks.filter((t) => t.status === "pending").length;
    const prog = allTasks.filter((t) => t.status === "in-progress").length;
    const done = allTasks.filter((t) => t.status === "completed").length;

    return [
      { day: "Todo", tasks: todo },
      { day: "In Prog", tasks: prog },
      { day: "Done", tasks: done },
    ];
  }, [allTasks]);

  const projectStatusData = useMemo(() => {
    const onTrack = recentProjects.filter((p) => p.status === "on-track").length;
    const atRisk = recentProjects.filter((p) => p.status === "at-risk").length;
    const delayed = recentProjects.filter((p) => p.status === "delayed").length;

    return [
      { name: "On Track", value: onTrack, color: "#10b981" },
      { name: "At Risk", value: atRisk, color: "#f59e0b" },
      { name: "Delayed", value: delayed, color: "#ef4444" },
    ];
  }, [recentProjects]);

  // You don’t have a workload endpoint yet, so keep empty for now
  const teamMembers: any[] = [];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Loading live project data...</p>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl text-gray-900">Dashboard</h1>
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">{errMsg}</div>
      </div>
    );
  }

  const totalProjects = recentProjects.length;
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === "completed").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Live system overview (projects + tasks)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Active Projects</CardTitle>
            <FolderKanban className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{totalProjects}</div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              Live count
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Tasks Completed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{doneTasks}</div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              Out of {totalTasks}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Team Members</CardTitle>
            <Users className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">—</div>
            <p className="text-xs text-gray-500 mt-1">Connect later to /team</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Avg. Completion Time</CardTitle>
            <Clock className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">—</div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <TrendingDown className="w-3 h-3 text-green-600" />
              Add later from analytics
            </p>
          </CardContent>
        </Card>
      </div>

      <ProjectAssistant
        role="admin"
        projects={recentProjects}
        tasks={allTasks}
        teamMembers={teamMembers}
        title="AI Project Assistant"
        subtitle="Prioritization, risks, and schedule signals (Admin view)"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tasks Overview</CardTitle>
            <CardDescription>Counts by status (live)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="tasks" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Status Distribution</CardTitle>
            <CardDescription>Live health status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>Live projects from database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-gray-900 mb-1">{project.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {project.tasks?.completed ?? 0}/{project.tasks?.total ?? 0} tasks
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Due {project.dueDate ?? "—"}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      project.status === "on-track"
                        ? "default"
                        : project.status === "at-risk"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {project.status.replace("-", " ")}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="text-gray-900">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

