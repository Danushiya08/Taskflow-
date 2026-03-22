import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  FolderKanban,
  Target,
  CheckCircle2,
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
import {
  getPagePaddingClass,
  getCardPaddingClass,
  getGridGapClass,
  getTitleClass,
  getCardTitleClass,
} from "@/lib/uiDensity";

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

export function Dashboard() {
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
        dueDate: p.dueDate
          ? formatDateByPreference(p.dueDate, preferences.dateFormat, preferences.timezone)
          : undefined,
        tasks: { total, completed },
        teamCount: Array.isArray(p.members) ? p.members.length : 0,
      };
    });
  }, [projectsRaw, tasksRaw, preferences.dateFormat, preferences.timezone]);

  const allTasks: Task[] = useMemo(() => {
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
          ? formatDateByPreference(t.dueDate, preferences.dateFormat, preferences.timezone)
          : undefined,
        progress,
      };
    });
  }, [tasksRaw, projectsRaw, preferences.dateFormat, preferences.timezone]);

  const productivityData = useMemo(() => {
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

  const teamMembers: any[] = [];

  const pageClass = `${getPagePaddingClass(compactMode)} bg-background text-foreground`;
  const gridGapClass = getGridGapClass(compactMode);
  const cardTopPaddingClass = getCardPaddingClass(compactMode);
  const titleClass = getTitleClass(compactMode);
  const cardTitleClass = getCardTitleClass(compactMode);

  const cardHeaderPadding = compactMode ? "pb-2" : "pb-4";
  const subtitleClass = compactMode ? "text-sm text-muted-foreground" : "text-muted-foreground";
  const metricValueClass = compactMode ? "text-xl font-semibold" : "text-2xl font-semibold";
  const chartHeight = compactMode ? 220 : 250;
  const pieOuterRadius = compactMode ? 68 : 80;
  const listSpacing = compactMode ? "space-y-3" : "space-y-4";
  const itemPadding = compactMode ? "p-3" : "p-4";
  const itemGap = compactMode ? "mb-2" : "mb-3";
  const progressSizeClass = compactMode ? "h-2" : "h-3";
  const metaIconClass = compactMode ? "w-3.5 h-3.5" : "w-4 h-4";

  if (loading || loadingPreferences) {
    return (
      <div className={pageClass}>
        <h1 className={titleClass}>Dashboard</h1>
        <p className={subtitleClass}>Loading live project data...</p>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className={pageClass}>
        <h1 className={titleClass}>Dashboard</h1>
        <div className="p-4 rounded border border-destructive/30 bg-destructive/10 text-destructive">
          {errMsg}
        </div>
      </div>
    );
  }

  const totalProjects = recentProjects.length;
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => t.status === "completed").length;

  return (
    <div className={pageClass}>
      <div>
        <h1 className={titleClass}>Dashboard</h1>
        <p className={subtitleClass}>Live system overview (projects + tasks)</p>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${gridGapClass}`}>
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Active Projects</CardTitle>
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={cardTopPaddingClass}>
            <div className={metricValueClass}>{totalProjects}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              Live count
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Tasks Completed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={cardTopPaddingClass}>
            <div className={metricValueClass}>{doneTasks}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              Out of {totalTasks}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Team Members</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={cardTopPaddingClass}>
            <div className={metricValueClass}>—</div>
            <p className="text-xs text-muted-foreground mt-1">Connect later to /team</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={`flex flex-row items-center justify-between ${cardHeaderPadding}`}>
            <CardTitle className="text-sm">Avg. Completion Time</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className={cardTopPaddingClass}>
            <div className={metricValueClass}>—</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
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

      <div className={`grid grid-cols-1 lg:grid-cols-2 ${gridGapClass}`}>
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={cardHeaderPadding}>
            <CardTitle className={cardTitleClass}>Tasks Overview</CardTitle>
            <CardDescription>Counts by status (live)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="tasks" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={cardHeaderPadding}>
            <CardTitle className={cardTitleClass}>Project Status Distribution</CardTitle>
            <CardDescription>Live health status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={pieOuterRadius}
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card text-card-foreground">
        <CardHeader className={cardHeaderPadding}>
          <CardTitle className={cardTitleClass}>Recent Projects</CardTitle>
          <CardDescription>Live projects from database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={listSpacing}>
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className={`${itemPadding} border border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer bg-card`}
              >
                <div className={`flex items-start justify-between ${itemGap}`}>
                  <div>
                    <h4 className="font-medium text-card-foreground mb-1">{project.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Target className={metaIconClass} />
                        {project.tasks?.completed ?? 0}/{project.tasks?.total ?? 0} tasks
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className={metaIconClass} />
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

                <div className={compactMode ? "space-y-1.5" : "space-y-2"}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-card-foreground">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className={progressSizeClass} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}