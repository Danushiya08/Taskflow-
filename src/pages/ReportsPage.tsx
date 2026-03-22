import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Users,
  DollarSign,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { formatCurrency } from "@/lib/currency";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  getPagePaddingClass,
  getCardPaddingClass,
  getGridGapClass,
  getTitleClass,
  getCardTitleClass,
  getButtonSizeClass,
  getInputSizeClass,
  getIconSizeClass,
} from "@/lib/uiDensity";

function useAuthFromStorage() {
  try {
    const raw = localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return { user };
  } catch {
    return { user: null };
  }
}

type DashboardResponse = {
  scope: string;
  range?: { start: string; end: string };
  kpis: {
    projectsCompleted: { value: number; deltaPct: number };
    avgTaskVelocity: { value: number; deltaPct: number };
    teamProductivity: { value: number; status: string };
    budgetEfficiency: { value: number; status: string };
  };
  charts: {
    completionTrend: { month: string; completed: number; inProgress: number }[];
    taskVelocity: { week: string; planned: number; completed: number }[];
    timeDistribution: { category: string; hours: number }[];
    productivityByMember: { userId: string; name?: string; productivity: number; tasks: number }[];
    budgetByProject: { project: string; allocated: number; spent: number; percentage: number }[];
  };
};

const TIME_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#94a3b8"];

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--card-foreground))",
  borderRadius: "8px",
};

export function ReportsPage() {
  const { user } = useAuthFromStorage();
  const { preferences } = useUserPreferences();
  const compactMode = preferences.compactMode;

  const role = String(user?.role || "").toLowerCase();

  const [range, setRange] = useState("last-30-days");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string>("");

  const canSeeReports = role !== "team-member";
  const isClient = role === "client";
  const isAdminOrPM = role === "admin" || role === "project-manager";

  const fetchDashboard = async (r: string) => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get<DashboardResponse>(`/reports/dashboard?range=${encodeURIComponent(r)}`);
      setData(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load reports");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canSeeReports) fetchDashboard(range);
  }, [range, canSeeReports]);

  const timeDistribution = useMemo(() => {
    const arr = data?.charts?.timeDistribution || [];
    return arr.map((x, idx) => ({ ...x, color: TIME_COLORS[idx % TIME_COLORS.length] }));
  }, [data]);

  const exportPDF = async () => {
    setExporting(true);
    setErr("");
    try {
      const res = await api.get(`/reports/export/pdf?range=${encodeURIComponent(range)}`, {
        responseType: "blob",
      });

      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "reports-dashboard.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const pageClass = `${getPagePaddingClass(compactMode)} bg-background text-foreground`;
  const gridGapClass = getGridGapClass(compactMode);
  const chartGridGapClass = getGridGapClass(compactMode);
  const cardTopPaddingClass = getCardPaddingClass(compactMode);
  const titleClass = getTitleClass(compactMode);
  const cardTitleClass = getCardTitleClass(compactMode);
  const buttonSizeClass = getButtonSizeClass(compactMode);
  const inputSizeClass = getInputSizeClass(compactMode);
  const metricIconClass = getIconSizeClass(compactMode);

  const cardHeaderPadding = compactMode ? "pb-2" : "pb-4";
  const chartHeight = compactMode ? 240 : 300;
  const pieChartHeight = compactMode ? 240 : 300;
  const pieChartWidth = compactMode ? "100%" : "40%";
  const listSpacing = compactMode ? "space-y-2" : "space-y-3";
  const budgetSpacing = compactMode ? "space-y-4" : "space-y-6";
  const progressHeight = compactMode ? "h-2" : "h-3";

  if (!canSeeReports) {
    return (
      <div className={pageClass}>
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={cardHeaderPadding}>
            <CardTitle className={cardTitleClass}>Reports & Analytics</CardTitle>
            <CardDescription>Access restricted</CardDescription>
          </CardHeader>
          <CardContent className={`text-muted-foreground ${cardTopPaddingClass}`}>
            Team Members don’t have access to the Reports & Analytics dashboard.
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasAnyChartData =
    (data?.charts?.completionTrend?.length || 0) > 0 ||
    (data?.charts?.taskVelocity?.length || 0) > 0 ||
    (data?.charts?.timeDistribution?.length || 0) > 0 ||
    (data?.charts?.productivityByMember?.length || 0) > 0 ||
    (data?.charts?.budgetByProject?.length || 0) > 0;

  return (
    <div className={pageClass}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={titleClass}>Reports & Analytics</h1>
          <p className="text-muted-foreground">
            {isClient
              ? "High-level visibility into your project progress"
              : "Comprehensive insights into project performance and team productivity"}
          </p>
          {data?.scope ? <p className="text-xs text-muted-foreground mt-1">Scope: {data.scope}</p> : null}
        </div>

        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className={`w-48 ${inputSizeClass}`}>
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-7-days">Last 7 Days</SelectItem>
              <SelectItem value="last-30-days">Last 30 Days</SelectItem>
              <SelectItem value="last-90-days">Last 90 Days</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={exportPDF} disabled={loading || exporting} className={buttonSizeClass}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Exporting..." : "Export Report"}
          </Button>
        </div>
      </div>

      {err ? (
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={`${cardTopPaddingClass} text-destructive`}>{err}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={`${cardTopPaddingClass} text-muted-foreground`}>Loading dashboard...</CardContent>
        </Card>
      ) : !data ? (
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={`${cardTopPaddingClass} text-muted-foreground`}>No data available.</CardContent>
        </Card>
      ) : !hasAnyChartData ? (
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className={cardHeaderPadding}>
            <CardTitle className={cardTitleClass}>No data available</CardTitle>
            <CardDescription>No projects/tasks/time entries found in the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Try selecting Last 90 Days or create tasks and time entries.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-4 ${gridGapClass}`}>
            <Card className="border-border bg-card text-card-foreground">
              <CardContent className={cardTopPaddingClass}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Projects Completed</p>
                    <p className={compactMode ? "text-xl font-semibold mt-1" : "text-2xl font-semibold mt-1"}>
                      {data.kpis.projectsCompleted.value}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <TrendingUp className="w-3 h-3" />
                      {data.kpis.projectsCompleted.deltaPct >= 0 ? "+" : ""}
                      {data.kpis.projectsCompleted.deltaPct}% vs previous period
                    </p>
                  </div>
                  <BarChart3 className={`${metricIconClass} text-blue-600`} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground">
              <CardContent className={cardTopPaddingClass}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg. Task Velocity</p>
                    <p className={compactMode ? "text-xl font-semibold mt-1" : "text-2xl font-semibold mt-1"}>
                      {data.kpis.avgTaskVelocity.value}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <TrendingUp className="w-3 h-3" />
                      Completed tasks/week
                    </p>
                  </div>
                  <TrendingUp className={`${metricIconClass} text-green-600`} />
                </div>
              </CardContent>
            </Card>

            <Card className={`border-border bg-card text-card-foreground ${isClient ? "opacity-60" : ""}`}>
              <CardContent className={cardTopPaddingClass}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Productivity</p>
                    <p className={compactMode ? "text-xl font-semibold mt-1" : "text-2xl font-semibold mt-1"}>
                      {isClient ? "Restricted" : `${data.kpis.teamProductivity.value}%`}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" />
                      {isClient ? "Not visible for clients" : data.kpis.teamProductivity.status}
                    </p>
                  </div>
                  <Users className={`${metricIconClass} text-purple-600`} />
                </div>
              </CardContent>
            </Card>

            <Card className={`border-border bg-card text-card-foreground ${isClient ? "opacity-60" : ""}`}>
              <CardContent className={cardTopPaddingClass}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Budget Efficiency</p>
                    <p className={compactMode ? "text-xl font-semibold mt-1" : "text-2xl font-semibold mt-1"}>
                      {isClient ? "Restricted" : `${data.kpis.budgetEfficiency.value}%`}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <TrendingDown className="w-3 h-3" />
                      {isClient ? "Not visible for clients" : data.kpis.budgetEfficiency.status}
                    </p>
                  </div>
                  <DollarSign className={`${metricIconClass} text-yellow-600`} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="projects" className="space-y-4">
            <TabsList className={compactMode ? "h-9" : "h-10"}>
              <TabsTrigger value="projects">Project Performance</TabsTrigger>
              {!isClient ? <TabsTrigger value="team">Team Analytics</TabsTrigger> : null}
              {isAdminOrPM ? <TabsTrigger value="budget">Budget & Resources</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="projects" className="space-y-4">
              <div className={`grid grid-cols-1 lg:grid-cols-2 ${chartGridGapClass}`}>
                <Card className="border-border bg-card text-card-foreground">
                  <CardHeader className={cardHeaderPadding}>
                    <CardTitle className={cardTitleClass}>Project Completion Trend</CardTitle>
                    <CardDescription>Completed vs In-Progress projects over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <AreaChart data={data.charts.completionTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Area type="monotone" dataKey="completed" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                        <Area type="monotone" dataKey="inProgress" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card text-card-foreground">
                  <CardHeader className={cardHeaderPadding}>
                    <CardTitle className={cardTitleClass}>Task Velocity</CardTitle>
                    <CardDescription>Planned vs Completed tasks per week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <BarChart data={data.charts.taskVelocity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="planned" fill="#94a3b8" />
                        <Bar dataKey="completed" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {!isClient ? (
                <Card className="border-border bg-card text-card-foreground">
                  <CardHeader className={cardHeaderPadding}>
                    <CardTitle className={cardTitleClass}>Time Distribution by Category</CardTitle>
                    <CardDescription>From Time Entries grouped by task.category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className={`flex items-center ${compactMode ? "gap-5" : "gap-8"} flex-col lg:flex-row`}>
                      <ResponsiveContainer width={pieChartWidth} height={pieChartHeight}>
                        <PieChart>
                          <Pie
                            data={timeDistribution}
                            cx="50%"
                            cy="50%"
                            outerRadius={compactMode ? 80 : 100}
                            dataKey="hours"
                          >
                            {timeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={(entry as any).color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={chartTooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className={`flex-1 ${listSpacing}`}>
                        {timeDistribution.map((item: any) => (
                          <div key={item.category} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={compactMode ? "w-3 h-3 rounded" : "w-4 h-4 rounded"}
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-card-foreground">{item.category}</span>
                            </div>
                            <span className="text-muted-foreground">{item.hours} hours</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {!isClient ? (
              <TabsContent value="team" className="space-y-4">
                <Card className="border-border bg-card text-card-foreground">
                  <CardHeader className={cardHeaderPadding}>
                    <CardTitle className={cardTitleClass}>Team Productivity Scores</CardTitle>
                    <CardDescription>Done tasks / total assigned tasks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <BarChart data={data.charts.productivityByMember}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="userId" hide />
                        <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="productivity" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}

            {isAdminOrPM ? (
              <TabsContent value="budget" className="space-y-4">
                <Card className="border-border bg-card text-card-foreground">
                  <CardHeader className={cardHeaderPadding}>
                    <CardTitle className={cardTitleClass}>Budget Allocation & Usage</CardTitle>
                    <CardDescription>From Project.budget.allocated and Project.budget.spent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className={budgetSpacing}>
                      {data.charts.budgetByProject.map((project) => (
                        <div key={project.project} className={compactMode ? "space-y-1.5" : "space-y-2"}>
                          <div className="flex items-center justify-between">
                            <span className="text-card-foreground">{project.project}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(project.spent, preferences.currency)} /{" "}
                              {formatCurrency(project.allocated, preferences.currency)}
                            </span>
                          </div>

                          <div className={`w-full bg-muted rounded-full ${progressHeight}`}>
                            <div
                              className={`h-full rounded-full ${
                                project.percentage > 90
                                  ? "bg-red-600"
                                  : project.percentage > 75
                                  ? "bg-yellow-600"
                                  : "bg-green-600"
                              }`}
                              style={{ width: `${project.percentage}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{project.percentage}% spent</span>
                            <span>
                              {formatCurrency(
                                project.allocated - project.spent,
                                preferences.currency
                              )}{" "}
                              remaining
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}
          </Tabs>
        </>
      )}
    </div>
  );
}