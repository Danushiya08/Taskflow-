import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import {
  Brain,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  ListChecks,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

// ✅ Accept both frontend + backend naming
export type Role = "admin" | "pm" | "project-manager" | "team-member" | "client";

// ✅ Backend supports "critical"
export type Task = {
  id: number | string;
  title: string;
  project: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "in-progress" | "completed";
  dueDate?: string; // ✅ optional now
  progress?: number; // 0-100
  assignee?: string;
  estimatedHours?: number;
};

export type Project = {
  id: number | string;
  name: string;
  status: "on-track" | "at-risk" | "delayed";
  dueDate?: string;
  deadline?: string;
  startDate?: string;
  progress: number;
  tasks?: { total: number; completed: number };
  teamCount?: number;
  phase?: string;
  budget?: string;
  spent?: string;
};

type InsightSeverity = "low" | "medium" | "high";
type InsightType = "risk" | "prediction" | "recommendation" | "summary";

type Insight = {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  message: string;
  evidence?: string[];
};

// ✅ normalize role so PM logic always works
function normalizeRole(role: Role): "admin" | "pm" | "team-member" | "client" {
  if (role === "project-manager") return "pm";
  return role as any;
}

function parseDate(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(dateStr?: string) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = target - start;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function severityBadgeVariant(sev: InsightSeverity) {
  if (sev === "high") return "destructive";
  if (sev === "medium") return "default";
  return "secondary";
}

function severityIcon(sev: InsightSeverity) {
  if (sev === "high") return <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />;
  if (sev === "medium") return <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />;
  return <Zap className="w-5 h-5 text-green-500 mt-0.5" />;
}

function priorityScore(p: Task["priority"]) {
  if (p === "critical") return 4;
  if (p === "high") return 3;
  if (p === "medium") return 2;
  return 1;
}

function statusScore(s: Task["status"]) {
  if (s === "in-progress") return 2;
  if (s === "pending") return 1;
  return 0;
}

function computeTaskUrgency(task: Task) {
  const d = daysUntil(task.dueDate);
  const dueScore =
    d === null ? 0 : d < 0 ? 5 : d === 0 ? 4 : d <= 2 ? 3 : d <= 5 ? 2 : 1;

  const progress =
    typeof task.progress === "number"
      ? task.progress
      : task.status === "completed"
      ? 100
      : 0;

  const progressPenalty = progress < 30 ? 2 : progress < 60 ? 1 : 0;

  return priorityScore(task.priority) * 3 + dueScore * 2 + statusScore(task.status) + progressPenalty;
}

function formatDays(d: number | null) {
  if (d === null) return "No due date";
  if (d < 0) return `${Math.abs(d)} day(s) overdue`;
  if (d === 0) return "Due today";
  return `Due in ${d} day(s)`;
}

function estimateDelayDays(project: Project) {
  const due = parseDate(project.dueDate ?? project.deadline);
  if (!due) return null;

  const remaining = Math.max(0, 100 - project.progress);

  let velocityPerWeek = 12;
  if (project.tasks?.total && project.tasks.total > 0) {
    const ratio = project.tasks.completed / project.tasks.total;
    velocityPerWeek = 10 + Math.round(ratio * 10);
  }

  const weeksNeeded = remaining / velocityPerWeek;
  const daysNeeded = Math.ceil(weeksNeeded * 7);

  const now = new Date();
  const predictedFinish = new Date(now.getTime() + daysNeeded * 24 * 60 * 60 * 1000);
  const diffDays = Math.round((predictedFinish.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

function buildInsights(params: {
  role: Role;
  projects?: Project[];
  tasks?: Task[];
  teamMembers?: { name: string; activeTasks?: number; tasksCompleted?: number; status?: "available" | "busy" }[];
}) {
  const role = normalizeRole(params.role);
  const projects = params.projects ?? [];
  const tasks = params.tasks ?? [];
  const teamMembers = params.teamMembers ?? [];

  const insights: Insight[] = [];

  const overdueTasks = tasks.filter((t) => (daysUntil(t.dueDate) ?? 999) < 0 && t.status !== "completed");
  if (overdueTasks.length > 0) {
    insights.push({
      type: "risk",
      severity: "high",
      title: "Overdue Tasks",
      message: `${overdueTasks.length} task(s) are overdue. Clear these first to reduce cascading delays.`,
      evidence: overdueTasks.slice(0, 3).map((t) => `${t.title} • ${t.project} • ${formatDays(daysUntil(t.dueDate))}`),
    });
  }

  const dueSoon = tasks.filter((t) => {
    const d = daysUntil(t.dueDate);
    return d !== null && d >= 0 && d <= 2 && t.status !== "completed";
  });
  if (dueSoon.length > 0) {
    insights.push({
      type: "risk",
      severity: dueSoon.length >= 4 ? "high" : "medium",
      title: "Deadlines Coming Fast",
      message: `${dueSoon.length} task(s) are due within 48 hours.`,
      evidence: dueSoon.slice(0, 4).map((t) => `${t.title} • ${formatDays(daysUntil(t.dueDate))}`),
    });
  }

  const delayedPredictions = projects
    .map((p) => ({ p, delay: estimateDelayDays(p) }))
    .filter((x) => x.delay !== null && x.delay > 0)
    .sort((a, b) => (b.delay ?? 0) - (a.delay ?? 0));

  if (delayedPredictions.length > 0) {
    const top = delayedPredictions[0];
    insights.push({
      type: "prediction",
      severity: (top.delay ?? 0) >= 7 ? "high" : "medium",
      title: "Delay Prediction",
      message: `${top.p.name} is likely to slip by ~${top.delay} day(s) based on remaining work vs. deadline.`,
      evidence: [
        `Progress: ${top.p.progress}%`,
        `Deadline: ${top.p.dueDate ?? top.p.deadline ?? "N/A"}`,
        `Signal: remaining work > expected velocity`,
      ],
    });
  }

  if (role === "admin" || role === "pm") {
    const overloaded = teamMembers.filter((m) => (m.activeTasks ?? 0) >= 5);
    const available = teamMembers.filter((m) => m.status === "available" || (m.activeTasks ?? 0) <= 2);

    if (overloaded.length > 0 && available.length > 0) {
      insights.push({
        type: "recommendation",
        severity: "medium",
        title: "Workload Balancing Opportunity",
        message: `Some members look overloaded while others have capacity. Consider reassigning 1–2 tasks.`,
        evidence: [
          `Overloaded: ${overloaded.slice(0, 2).map((x) => `${x.name} (${x.activeTasks} active)`).join(", ")}`,
          `Available: ${available.slice(0, 2).map((x) => `${x.name} (${x.activeTasks ?? 0} active)`).join(", ")}`,
        ],
      });
    }
  }

  if (role === "client") {
    const atRisk = projects.filter((p) => p.status === "at-risk" || p.status === "delayed");
    insights.push({
      type: "summary",
      severity: atRisk.length > 0 ? "medium" : "low",
      title: "Client Summary",
      message:
        atRisk.length > 0
          ? `There are ${atRisk.length} project(s) needing attention. Ask for an updated timeline and next milestone ETA.`
          : "All projects look stable. Next steps are progressing normally.",
      evidence: atRisk.slice(0, 3).map((p) => `${p.name} • ${p.status} • ${p.progress}%`),
    });
  }

  if (role === "team-member") {
    const actionable = tasks
      .filter((t) => t.status !== "completed")
      .sort((a, b) => computeTaskUrgency(b) - computeTaskUrgency(a))
      .slice(0, 3);

    insights.push({
      type: "recommendation",
      severity: actionable.length > 0 ? "medium" : "low",
      title: "Today’s Focus",
      message:
        actionable.length > 0
          ? "Work top-down. Finish the most urgent items first to prevent deadline compression."
          : "No urgent tasks detected today. Keep momentum by clearing pending items.",
      evidence: actionable.map((t) => `${t.title} • ${t.project} • ${formatDays(daysUntil(t.dueDate))}`),
    });
  }

  if (role === "pm") {
    const riskyProjects = projects
      .map((p) => ({ p, delay: estimateDelayDays(p) }))
      .filter((x) => x.p.status !== "on-track" || (x.delay ?? 0) > 0)
      .slice(0, 3);

    if (riskyProjects.length > 0) {
      insights.push({
        type: "summary",
        severity: "medium",
        title: "PM Summary",
        message: "Your key risk is schedule pressure. Tighten scope, unblock critical tasks, and rebalance workload.",
        evidence: riskyProjects.map(
          (x) => `${x.p.name} • ${x.p.status} • ${x.p.progress}% • predicted slip: ${x.delay ?? 0} day(s)`
        ),
      });
    }
  }

  if (role === "admin") {
    const delayed = projects.filter((p) => p.status === "delayed");
    const atRisk = projects.filter((p) => p.status === "at-risk");
    insights.push({
      type: "summary",
      severity: delayed.length > 0 ? "high" : atRisk.length > 0 ? "medium" : "low",
      title: "System Overview Summary",
      message:
        delayed.length > 0
          ? `You have ${delayed.length} delayed project(s). Escalate blockers and review resource allocation.`
          : atRisk.length > 0
          ? `You have ${atRisk.length} at-risk project(s). Consider corrective actions before they slip.`
          : "Portfolio looks healthy today.",
      evidence: [
        `Delayed: ${delayed.length}`,
        `At risk: ${atRisk.length}`,
        `On track: ${projects.filter((p) => p.status === "on-track").length}`,
      ],
    });
  }

  return insights.slice(0, 6);
}

export function ProjectAssistant(props: {
  role: Role;
  projects?: Project[];
  tasks?: Task[];
  teamMembers?: { name: string; activeTasks?: number; tasksCompleted?: number; status?: "available" | "busy" }[];
  title?: string;
  subtitle?: string;
}) {
  const { role, projects, tasks, teamMembers } = props;
  const [refreshKey, setRefreshKey] = React.useState(0);

  const insights = React.useMemo(
    () => buildInsights({ role, projects, tasks, teamMembers }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, refreshKey, JSON.stringify(projects ?? []), JSON.stringify(tasks ?? []), JSON.stringify(teamMembers ?? [])]
  );

  const todayList = React.useMemo(() => {
    const list = (tasks ?? [])
      .filter((t) => t.status !== "completed")
      .sort((a, b) => computeTaskUrgency(b) - computeTaskUrgency(a))
      .slice(0, normalizeRole(role) === "admin" ? 5 : 3);
    return list;
  }, [tasks, role]);

  const risks = insights.filter((i) => i.type === "risk" || i.type === "prediction");
  const summaries = insights.filter((i) => i.type === "summary" || i.type === "recommendation");

  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            {props.title ?? "AI Project Assistant"}
          </CardTitle>
          <CardDescription>
            {props.subtitle ??
              "Prioritization, risk alerts, delay prediction, and daily recommendations from your live project data"}
          </CardDescription>
        </div>

        <Button variant="secondary" className="gap-2" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="today">
          <TabsList className="mb-4">
            <TabsTrigger value="today" className="gap-2">
              <ListChecks className="w-4 h-4" /> Today
            </TabsTrigger>
            <TabsTrigger value="risks" className="gap-2">
              <ShieldAlert className="w-4 h-4" /> Risks
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-2">
              <CheckCircle2 className="w-4 h-4" /> Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            {todayList.length === 0 ? (
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-600">
                No actionable tasks found.
              </div>
            ) : (
              <div className="space-y-3">
                {todayList.map((t) => {
                  const d = daysUntil(t.dueDate);
                  const urgency = computeTaskUrgency(t);

                  return (
                    <div
                      key={t.id}
                      className="bg-white p-4 rounded-lg border border-gray-200 flex items-start justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm text-gray-900">{t.title}</h4>

                          <Badge
                            className={
                              t.priority === "critical"
                                ? "bg-red-200 text-red-800 border border-red-300"
                                : t.priority === "high"
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : t.priority === "medium"
                                ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                                : "bg-blue-100 text-blue-700 border border-blue-200"
                            }
                          >
                            {t.priority}
                          </Badge>

                          <Badge variant="secondary" className="text-xs">
                            score {urgency}
                          </Badge>
                        </div>

                        <p className="text-xs text-gray-600">{t.project}</p>

                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{formatDays(d)}</span>
                          {t.status !== "completed" && (
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {t.status.replace("-", " ")}
                            </span>
                          )}
                        </div>

                        {typeof t.progress === "number" && t.status !== "completed" && (
                          <p className="text-xs text-gray-500 mt-1">Progress: {t.progress}%</p>
                        )}
                      </div>

                      <div className="w-56 text-xs text-gray-600">
                        <p className="font-medium text-gray-900 mb-1">Why this is first:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>{t.priority} priority</li>
                          <li>{formatDays(d)}</li>
                          {typeof t.progress === "number" && t.progress < 60 && <li>Low progress vs timeline</li>}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="risks">
            {risks.length === 0 ? (
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-600">
                No major risk signals detected right now.
              </div>
            ) : (
              <div className="space-y-3">
                {risks.map((ins, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 flex items-start gap-3">
                    {severityIcon(ins.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm text-gray-900">{ins.title}</h4>
                        <Badge variant={severityBadgeVariant(ins.severity)}>{ins.severity}</Badge>
                        <Badge variant="secondary">{ins.type}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{ins.message}</p>

                      {ins.evidence?.length ? (
                        <ul className="mt-2 text-xs text-gray-600 list-disc pl-4 space-y-1">
                          {ins.evidence.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary">
            {summaries.length === 0 ? (
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-600">
                No summary available.
              </div>
            ) : (
              <div className="space-y-3">
                {summaries.map((ins, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 flex items-start gap-3">
                    {ins.severity === "low" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : ins.severity === "medium" ? (
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm text-gray-900">{ins.title}</h4>
                        <Badge variant={severityBadgeVariant(ins.severity)}>{ins.severity}</Badge>
                        <Badge variant="secondary">{ins.type}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{ins.message}</p>

                      {ins.evidence?.length ? (
                        <ul className="mt-2 text-xs text-gray-600 list-disc pl-4 space-y-1">
                          {ins.evidence.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
