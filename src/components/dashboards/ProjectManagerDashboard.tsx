import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SmartAlertsCard } from "@/components/SmartAlertsCard";
import {
  CheckCircle2,
  TrendingUp,
  Calendar,
  Users,
  FolderKanban,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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

export function ProjectManagerDashboard() {
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
        dueDate: p.dueDate
          ? formatDateByPreference(p.dueDate, preferences.dateFormat)
          : undefined,
        tasks: { total, completed },
        teamCount: Array.isArray(p.members) ? p.members.length : 0,
      };
    });
  }, [projectsRaw, tasksRaw, preferences.dateFormat]);

  const pmTasks: Task[] = useMemo(() => {
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
        dueDate: t.dueDate
          ? formatDateByPreference(t.dueDate, preferences.dateFormat)
          : undefined,
        progress,
      };
    });
  }, [tasksRaw, projectsRaw, preferences.dateFormat]);

  const myProjectsData = useMemo(() => {
    return myProjects.slice(0, 5).map((p, idx) => ({
      day: `P${idx + 1}`,
      tasks: p.progress,
    }));
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

  const teamMembers: any[] = [];

  const pagePadding = compactMode ? "p-4" : "p-6";
  const sectionSpacing = compactMode ? "space-y-4" : "space-y-6";
  const gridGap = compactMode ? "gap-4" : "gap-6";
  const cardHeaderPadding = compactMode ? "pb-2" : "pb-4";
  const cardTopPadding = compactMode ? "pt-4" : "pt-6";
  const titleClass = compactMode
    ? "text-2xl font-semibold text-foreground"
    : "text-3xl font-semibold text-foreground";
  const subtitleClass = compactMode ? "text-sm text-muted-foreground" : "text-muted-foreground";
  const cardTitleClass = compactMode ? "text-base" : "text-lg";
  const metricValueClass = compactMode
    ? "text-xl font-semibold text-foreground"
    : "text-2xl font-semibold text-foreground";
  const chartHeight = compactMode ? 220 : 256;
  const progressHeight = compactMode ? "h-2" : "h-3";

  if (loading || loadingPreferences) {
    return (
      <div className={`${pagePadding} ${sectionSpacing} bg-background text-foreground`}>
        <h1 className={titleClass}>Project Manager Dashboard</h1>
        <p className={subtitleClass}>Loading live project data...</p>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className={`${pagePadding} ${sectionSpacing} bg-background text-foreground`}>
        <h1 className={titleClass}>Project Manager Dashboard</h1>
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {errMsg}
        </div>
      </div>
    );
  }

  return (
    <div className={`${pagePadding} ${sectionSpacing} bg-background text-foreground`}>
      <div>
        <h1 className={titleClass}>Project Manager Dashboard</h1>
        <p className={subtitleClass}>Manage your projects and team performance</p>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${gridGap}`}>
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">My Projects</CardTitle>
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={cardTopPadding}>
            <div className={metricValueClass}>{myProjects.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Live from database</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Team Members</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={cardTopPadding}>
            <div className={metricValueClass}>—</div>
            <p className="text-xs text-muted-foreground mt-1">Connect later to /team</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Active Tasks</CardTitle>
            <Target className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={cardTopPadding}>
            <div className={metricValueClass}>
              {pmTasks.filter((t) => t.status !== "completed").length}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-600">Live</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Completion Rate</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={cardTopPadding}>
            <div className={metricValueClass}>
              {pmTasks.length
                ? Math.round(
                    (pmTasks.filter((t) => t.status === "completed").length / pmTasks.length) * 100
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">From live task status</p>
          </CardContent>
        </Card>
      </div>

      <SmartAlertsCard tasks={pmTasks} projects={myProjects} />

      <ProjectAssistant
        role="project-manager"
        projects={myProjects}
        tasks={pmTasks}
        teamMembers={teamMembers}
        title="AI Project Assistant (PM)"
        subtitle="Live risks, schedule signals, and today’s priorities"
      />

      <div className={`grid grid-cols-1 lg:grid-cols-2 ${gridGap}`}>
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={cardHeaderPadding}>
            <CardTitle className={cardTitleClass}>My Projects</CardTitle>
            <CardDescription>Projects in database</CardDescription>
          </CardHeader>
          <CardContent className={compactMode ? "space-y-3" : "space-y-4"}>
            {myProjects.map((project) => (
              <div key={project.id} className={compactMode ? "space-y-1.5" : "space-y-2"}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm text-card-foreground">{project.name}</h4>
                    <Badge variant={project.status === "on-track" ? "default" : "secondary"}>
                      {project.status === "on-track"
                        ? "On Track"
                        : project.status === "at-risk"
                        ? "At Risk"
                        : "Delayed"}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{project.progress}%</span>
                </div>

                <Progress value={project.progress} className={progressHeight} />

                <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{project.teamCount ?? "-"} members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>
                        {project.tasks?.completed ?? 0}/{project.tasks?.total ?? 0} tasks
                      </span>
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

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={cardHeaderPadding}>
            <CardTitle className={cardTitleClass}>Task Status</CardTitle>
            <CardDescription>Live distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart>
                  <Pie
                    data={teamPerformanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={compactMode ? 50 : 60}
                    outerRadius={compactMode ? 76 : 90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {teamPerformanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-2 ${gridGap}`}>
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={cardHeaderPadding}>
            <CardTitle className={cardTitleClass}>Project Progress</CardTitle>
            <CardDescription>Progress per project (top 5)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={myProjectsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip contentStyle={chartTooltipStyle} />
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