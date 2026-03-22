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
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { formatDateByPreference } from "@/lib/dateFormat";

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

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--card-foreground))",
  borderRadius: "8px",
};

export function ClientDashboard() {
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [projectsRaw, setProjectsRaw] = useState<BackendProject[]>([]);
  const [tasksRaw, setTasksRaw] = useState<BackendTask[]>([]);

  const { preferences, loadingPreferences } = useUserPreferences();
  const compactMode = preferences.compactMode;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrMsg(null);

      try {
        const pRes = await api.get<{ projects: BackendProject[] }>("/projects");
        const projects = (pRes.data?.projects ?? []).filter((p) => !p.archived);
        setProjectsRaw(projects);

        const taskCalls = projects.map(async (p) => {
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
        deadline: p.dueDate ? formatDateByPreference(p.dueDate, preferences.dateFormat) : undefined,
        dueDate: p.dueDate ? formatDateByPreference(p.dueDate, preferences.dateFormat) : undefined,
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
  }, [projectsRaw, tasksRaw, preferences.dateFormat]);

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
        dueDate: t.dueDate ? formatDateByPreference(t.dueDate, preferences.dateFormat) : undefined,
        progress,
      };
    });
  }, [tasksRaw, projectsRaw, preferences.dateFormat]);

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

  const getMilestoneIcon = (status: string, compact = false) => {
    const iconClass = compact ? "w-4 h-4" : "w-5 h-5";
    switch (status) {
      case "completed":
        return <CheckCircle2 className={`${iconClass} text-green-600`} />;
      case "in-progress":
        return <Clock className={`${iconClass} text-blue-600`} />;
      case "upcoming":
        return <Calendar className={`${iconClass} text-gray-400`} />;
      default:
        return <Calendar className={`${iconClass} text-gray-400`} />;
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

  const pagePadding = compactMode ? "p-4" : "p-6";
  const sectionSpacing = compactMode ? "space-y-4" : "space-y-6";
  const gridGap = compactMode ? "gap-4" : "gap-6";
  const cardHeaderPadding = compactMode ? "pb-2" : "pb-4";
  const cardTopPadding = compactMode ? "pt-4" : "pt-6";
  const titleClass = compactMode ? "text-2xl font-semibold text-gray-900" : "text-3xl text-gray-900";
  const subtitleClass = compactMode ? "text-sm text-gray-600" : "text-gray-600";
  const cardTitleClass = compactMode ? "text-base" : "text-lg";
  const metricValueClass = compactMode ? "text-xl text-gray-900 font-semibold" : "text-2xl text-gray-900";
  const chartHeight = compactMode ? 220 : 256;
  const progressHeight = compactMode ? "h-2" : "h-3";
  const listSpacing = compactMode ? "space-y-3" : "space-y-4";
  const boxPadding = compactMode ? "p-3" : "p-4";
  const milestoneGap = compactMode ? "gap-2.5" : "gap-3";
  const quickActionPadding = compactMode ? "p-3" : "p-4";

  if (loading || loadingPreferences) {
    return (
      <div className={`${pagePadding} ${sectionSpacing}`}>
        <h1 className={titleClass}>Client Portal</h1>
        <p className={subtitleClass}>Loading your projects...</p>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className={`${pagePadding} ${sectionSpacing}`}>
        <h1 className={titleClass}>Client Portal</h1>
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">{errMsg}</div>
        <p className="text-sm text-gray-600">
          Check backend logs for: <span className="font-mono">GET /projects</span> and{" "}
          <span className="font-mono">GET /api/projects/&lt;projectId&gt;/tasks</span>
        </p>
      </div>
    );
  }

  return (
    <div className={`${pagePadding} ${sectionSpacing}`}>
      <div>
        <h1 className={titleClass}>Client Portal</h1>
        <p className={subtitleClass}>View your project progress and updates</p>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${gridGap}`}>
        <Card>
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Active Projects</CardTitle>
            <Target className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent className={cardTopPadding}>
            <div className={metricValueClass}>{stats.active}</div>
            <p className="text-xs text-gray-600 mt-1">
              {stats.onTrack} on track, {stats.atRisk} need attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Overall Progress</CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent className={cardTopPadding}>
            <div className={metricValueClass}>{stats.top ? `${stats.top.progress}%` : "—"}</div>
            <p className="text-xs text-gray-600 mt-1">{stats.top?.name ?? "No projects"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Team Members</CardTitle>
            <Users className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent className={cardTopPadding}>
            <div className={metricValueClass}>{stats.teamMembers}</div>
            <p className="text-xs text-gray-600 mt-1">Across your projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Documents</CardTitle>
            <FileText className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent className={cardTopPadding}>
            <div className={metricValueClass}>—</div>
            <p className="text-xs text-gray-600 mt-1">Hook later to your docs module</p>
          </CardContent>
        </Card>
      </div>

      <ProjectAssistant
        role="client"
        projects={myProjects}
        tasks={clientTasks}
        title="AI Project Assistant"
        subtitle="Clear summaries, risks, and what needs attention"
      />

      <div className={`grid grid-cols-1 lg:grid-cols-2 ${gridGap}`}>
        {myProjects.map((project) => (
          <Card key={project.id}>
            <CardHeader className={cardHeaderPadding}>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className={cardTitleClass}>{project.name}</CardTitle>
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
            <CardContent className={compactMode ? "space-y-3" : "space-y-4"}>
              <div className={compactMode ? "space-y-1.5" : "space-y-2"}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Overall Progress</span>
                  <span className="text-gray-900">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className={progressHeight} />
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

      <div className={`grid grid-cols-1 lg:grid-cols-2 ${gridGap}`}>
        <Card>
          <CardHeader className={cardHeaderPadding}>
            <CardTitle className={cardTitleClass}>Project Progress</CardTitle>
            <CardDescription>Live progress snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full min-w-0">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={projectProgressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="progress"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: compactMode ? 3 : 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={cardHeaderPadding}>
            <CardTitle className={cardTitleClass}>Milestones</CardTitle>
            <CardDescription>Template milestones (connect later)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={listSpacing}>
              {milestones.map((milestone, index) => (
                <div key={index} className={`flex items-start ${milestoneGap}`}>
                  {getMilestoneIcon(milestone.status, compactMode)}
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

      <Card>
        <CardHeader className={cardHeaderPadding}>
          <CardTitle className={cardTitleClass}>Recent Updates</CardTitle>
          <CardDescription>Latest updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={listSpacing}>
            {recentUpdates.map((update, index) => (
              <div key={index} className={`flex items-start gap-4 ${boxPadding} bg-gray-50 rounded-lg`}>
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

      <Card>
        <CardHeader className={cardHeaderPadding}>
          <CardTitle className={cardTitleClass}>Quick Actions</CardTitle>
          <CardDescription>Common tasks and resources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 md:grid-cols-3 ${gridGap}`}>
            <button className={`${quickActionPadding} bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors`}>
              <FileText className="w-6 h-6 text-blue-600 mb-2" />
              <h4 className="text-sm text-gray-900 mb-1">View Reports</h4>
              <p className="text-xs text-gray-600">Connect later to documents module</p>
            </button>
            <button className={`${quickActionPadding} bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors`}>
              <Calendar className="w-6 h-6 text-green-600 mb-2" />
              <h4 className="text-sm text-gray-900 mb-1">Schedule Meeting</h4>
              <p className="text-xs text-gray-600">Connect later to meetings module</p>
            </button>
            <button className={`${quickActionPadding} bg-purple-50 hover:bg-purple-100 rounded-lg text-left transition-colors`}>
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