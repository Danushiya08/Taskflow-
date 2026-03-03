import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
  Calendar,
  AlertCircle,
  Users,
  Target,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import api from "@/lib/api";
import { ProjectAssistant } from "@/components/ProjectAssistant";
import type { Project, Task } from "@/components/ProjectAssistant";

type BackendProject = {
  _id: string;
  name: string;
  status: "planning" | "active" | "on-hold" | "completed";
  progress?: number;
  dueDate?: string | null;
  budget?: { allocated: number; spent: number };
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

export function ClientDashboard() {
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
          // ✅ FIX: backend mounts task routes under "/api" (not "/api/tasks")
          // so tasks endpoint is: GET /api/projects/:projectId/tasks
          const tRes = await api.get<{ tasks: BackendTask[] }>(`/projects/${p._id}/tasks`);
          return tRes.data?.tasks ?? [];
        });

        const results = await Promise.all(taskCalls);
        setTasksRaw(results.flat());
      } catch (e: any) {
        setErrMsg(e?.response?.data?.message || e?.message || "Failed to load client dashboard");
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
        deadline: p.dueDate ? formatDate(p.dueDate) : undefined,
        dueDate: p.dueDate ? formatDate(p.dueDate) : undefined,
        tasks: { total, completed },
        teamCount: Array.isArray(p.members) ? p.members.length : 0,
        budget: `$${Number(p.budget?.allocated ?? 0).toLocaleString()}`,
        spent: `$${Number(p.budget?.spent ?? 0).toLocaleString()}`,
        phase:
          p.status === "planning"
            ? "Planning"
            : p.status === "active"
            ? "Active"
            : p.status === "on-hold"
            ? "On Hold"
            : "Completed",
      };
    });
  }, [projectsRaw, tasksRaw]);

  const clientTasks: Task[] = useMemo(() => {
    return tasksRaw.map((t) => {
      const projectName =
        projectsRaw.find((p) => String(p._id) === String(t.projectId))?.name || "Project";
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
    const active = myProjects.length;
    const onTrack = myProjects.filter((p) => p.status === "on-track").length;
    const atRisk = myProjects.filter((p) => p.status !== "on-track").length;

    const top = [...myProjects].sort((a, b) => b.progress - a.progress)[0];

    const teamMembers = myProjects.reduce((sum, p) => sum + (p.teamCount ?? 0), 0);

    return { active, onTrack, atRisk, top, teamMembers };
  }, [myProjects]);

  const projectProgressData = useMemo(() => {
    const rows = myProjects.slice(0, 6).map((p, idx) => ({
      week: `P${idx + 1}`,
      progress: p.progress,
    }));
    return rows.length ? rows : [{ week: "P1", progress: 0 }];
  }, [myProjects]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on-track":
        return "bg-green-100 text-green-700";
      case "at-risk":
        return "bg-yellow-100 text-yellow-700";
      case "delayed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getMilestoneIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "upcoming":
        return <Calendar className="w-5 h-5 text-gray-400" />;
      default:
        return <Calendar className="w-5 h-5 text-gray-400" />;
    }
  };

  const milestones = [
    { name: "Kickoff / Planning", status: "completed", date: "—" },
    { name: "Build / Delivery", status: "in-progress", date: "—" },
    { name: "Testing & QA", status: "upcoming", date: "—" },
    { name: "Final Delivery", status: "upcoming", date: "—" },
  ];

  const recentUpdates = [
    {
      title: "Projects synced",
      project: "All Projects",
      description: "Dashboard loaded from live backend data",
      date: "Today",
      type: "milestone",
    },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl text-gray-900">Client Portal</h1>
        <p className="text-gray-600">Loading your projects...</p>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl text-gray-900">Client Portal</h1>
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">{errMsg}</div>
        <p className="text-sm text-gray-600">
          Check backend logs for: <span className="font-mono">GET /projects</span> and{" "}
          <span className="font-mono">GET /api/projects/&lt;projectId&gt;/tasks</span>
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl text-gray-900">Client Portal</h1>
        <p className="text-gray-600">View your project progress and updates</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Active Projects</CardTitle>
            <Target className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{stats.active}</div>
            <p className="text-xs text-gray-600 mt-1">
              {stats.onTrack} on track, {stats.atRisk} need attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Overall Progress</CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{stats.top ? `${stats.top.progress}%` : "—"}</div>
            <p className="text-xs text-gray-600 mt-1">{stats.top?.name ?? "No projects"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Team Members</CardTitle>
            <Users className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{stats.teamMembers}</div>
            <p className="text-xs text-gray-600 mt-1">Across your projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Documents</CardTitle>
            <FileText className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">—</div>
            <p className="text-xs text-gray-600 mt-1">Hook later to your docs module</p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ AI Project Assistant */}
      <ProjectAssistant
        role="client"
        projects={myProjects}
        tasks={clientTasks}
        title="AI Project Assistant"
        subtitle="Clear summaries, risks, and what needs attention"
      />

      {/* Projects Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {myProjects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>Current Phase: {project.phase ?? "—"}</CardDescription>
                </div>
                <Badge className={getStatusColor(project.status)}>
                  {project.status === "on-track"
                    ? "On Track"
                    : project.status === "at-risk"
                    ? "At Risk"
                    : "Delayed"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Overall Progress</span>
                  <span className="text-gray-900">{project.progress}%</span>
                </div>
                <Progress value={project.progress} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Deadline</p>
                  <p className="text-gray-900">{project.deadline ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Tasks</p>
                  <p className="text-gray-900">
                    {project.tasks?.completed ?? 0}/{project.tasks?.total ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Budget</p>
                  <p className="text-gray-900">{project.budget ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Spent</p>
                  <p className="text-gray-900">{project.spent ?? "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <Users className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600">
                  {project.teamCount ?? 0} team members assigned
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Project Progress</CardTitle>
            <CardDescription>Live progress snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full min-w-0">
              <ResponsiveContainer width="100%" height={256}>
                <LineChart data={projectProgressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="progress"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Milestones (placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <CardDescription>Template milestones (connect later)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {milestones.map((milestone, index) => (
                <div key={index} className="flex items-start gap-3">
                  {getMilestoneIcon(milestone.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-900">{milestone.name}</p>
                      <span className="text-xs text-gray-600">{milestone.date}</span>
                    </div>
                    <p className="text-xs text-gray-500 capitalize">
                      {milestone.status.replace("-", " ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Updates</CardTitle>
          <CardDescription>Latest updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentUpdates.map((update, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="mt-1">
                  {update.type === "milestone" && <Target className="w-5 h-5 text-blue-600" />}
                  {update.type === "document" && <FileText className="w-5 h-5 text-green-600" />}
                  {update.type === "meeting" && <Calendar className="w-5 h-5 text-purple-600" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm text-gray-900 mb-1">{update.title}</h4>
                      <p className="text-xs text-gray-600 mb-1">{update.project}</p>
                      <p className="text-xs text-gray-600">{update.description}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{update.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and resources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors">
              <FileText className="w-6 h-6 text-blue-600 mb-2" />
              <h4 className="text-sm text-gray-900 mb-1">View Reports</h4>
              <p className="text-xs text-gray-600">Connect later to documents module</p>
            </button>
            <button className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors">
              <Calendar className="w-6 h-6 text-green-600 mb-2" />
              <h4 className="text-sm text-gray-900 mb-1">Schedule Meeting</h4>
              <p className="text-xs text-gray-600">Connect later to meetings module</p>
            </button>
            <button className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-left transition-colors">
              <AlertCircle className="w-6 h-6 text-purple-600 mb-2" />
              <h4 className="text-sm text-gray-900 mb-1">Submit Feedback</h4>
              <p className="text-xs text-gray-600">Connect later to feedback module</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}