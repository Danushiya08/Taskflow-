import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, TrendingUp, Calendar, Users, FolderKanban, Target } from "lucide-react";
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

export function ProjectManagerDashboard() {
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
        setErrMsg(e?.response?.data?.message || e?.message || "Failed to load PM dashboard");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const myProjects: Project[] = useMemo(() => {
    return projectsRaw.map((p) => {
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

  const pmTasks: Task[] = useMemo(() => {
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

  const myProjectsData = useMemo(() => {
    // chart: projects by progress
    return myProjects.slice(0, 5).map((p, idx) => ({ day: `P${idx + 1}`, tasks: p.progress }));
  }, [myProjects]);

  const teamPerformanceData = useMemo(() => {
    const completed = pmTasks.filter((t) => t.status === "completed").length;
    const inProgress = pmTasks.filter((t) => t.status === "in-progress").length;
    const pending = pmTasks.filter((t) => t.status === "pending").length;

    return [
      { name: "Completed", value: completed, color: "#10b981" },
      { name: "In Progress", value: inProgress, color: "#3b82f6" },
      { name: "Pending", value: pending, color: "#f59e0b" },
    ];
  }, [pmTasks]);

  const teamMembers: any[] = []; // connect later to /team

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl text-gray-900">Project Manager Dashboard</h1>
        <p className="text-gray-600">Loading live project data...</p>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl text-gray-900">Project Manager Dashboard</h1>
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">{errMsg}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl text-gray-900">Project Manager Dashboard</h1>
        <p className="text-gray-600">Manage your projects and team performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">My Projects</CardTitle>
            <FolderKanban className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{myProjects.length}</div>
            <p className="text-xs text-gray-600 mt-1">Live from database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Team Members</CardTitle>
            <Users className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">—</div>
            <p className="text-xs text-gray-600 mt-1">Connect later to /team</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Active Tasks</CardTitle>
            <Target className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{pmTasks.filter((t) => t.status !== "completed").length}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-600">Live</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Completion Rate</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">
              {pmTasks.length ? Math.round((pmTasks.filter((t) => t.status === "completed").length / pmTasks.length) * 100) : 0}%
            </div>
            <p className="text-xs text-gray-600 mt-1">From live task status</p>
          </CardContent>
        </Card>
      </div>

      <ProjectAssistant
        role="project-manager"
        projects={myProjects}
        tasks={pmTasks}
        teamMembers={teamMembers}
        title="AI Project Assistant (PM)"
        subtitle="Live risks, schedule signals, and today’s priorities"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>My Projects</CardTitle>
            <CardDescription>Projects in database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {myProjects.map((project) => (
              <div key={project.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm text-gray-900">{project.name}</h4>
                    <Badge variant={project.status === "on-track" ? "default" : "secondary"}>
                      {project.status === "on-track" ? "On Track" : project.status === "at-risk" ? "At Risk" : "Delayed"}
                    </Badge>
                  </div>
                  <span className="text-sm text-gray-600">{project.progress}%</span>
                </div>
                <Progress value={project.progress} />
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{project.teamCount ?? "-"} members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{project.tasks?.completed ?? 0}/{project.tasks?.total ?? 0} tasks</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{project.dueDate ?? "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Status</CardTitle>
            <CardDescription>Live distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={teamPerformanceData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                    {teamPerformanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Progress</CardTitle>
            <CardDescription>Progress per project (top 5)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={myProjectsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="tasks" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
