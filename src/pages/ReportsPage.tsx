import{ useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, TrendingDown, BarChart3, Calendar, Users, DollarSign } from "lucide-react";
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

export function ReportsPage() {
  const { user } = useAuthFromStorage();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

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

  if (!canSeeReports) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Reports & Analytics</CardTitle>
            <CardDescription>Access restricted</CardDescription>
          </CardHeader>
          <CardContent className="text-gray-700">
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Reports & Analytics</h1>
          <p className="text-gray-600">
            {isClient ? "High-level visibility into your project progress" : "Comprehensive insights into project performance and team productivity"}
          </p>
          {data?.scope ? <p className="text-xs text-gray-500 mt-1">Scope: {data.scope}</p> : null}
        </div>

        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-48">
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

          <Button onClick={exportPDF} disabled={loading || exporting}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Exporting..." : "Export Report"}
          </Button>
        </div>
      </div>

      {err ? (
        <Card>
          <CardContent className="pt-6 text-red-600">{err}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-gray-600">Loading dashboard...</CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="pt-6 text-gray-600">No data available.</CardContent>
        </Card>
      ) : !hasAnyChartData ? (
        <Card>
          <CardHeader>
            <CardTitle>No data available</CardTitle>
            <CardDescription>No projects/tasks/time entries found in the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="text-gray-700">
            Try selecting Last 90 Days OR create tasks and time entries.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Projects Completed</p>
                    <p className="text-2xl text-gray-900 mt-1">{data.kpis.projectsCompleted.value}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                      <TrendingUp className="w-3 h-3" />
                      {data.kpis.projectsCompleted.deltaPct >= 0 ? "+" : ""}
                      {data.kpis.projectsCompleted.deltaPct}% vs previous period
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Avg. Task Velocity</p>
                    <p className="text-2xl text-gray-900 mt-1">{data.kpis.avgTaskVelocity.value}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                      <TrendingUp className="w-3 h-3" />
                      Completed tasks/week
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className={isClient ? "opacity-60" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Team Productivity</p>
                    <p className="text-2xl text-gray-900 mt-1">{isClient ? "Restricted" : `${data.kpis.teamProductivity.value}%`}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" />
                      {isClient ? "Not visible for clients" : data.kpis.teamProductivity.status}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className={isClient ? "opacity-60" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Budget Efficiency</p>
                    <p className="text-2xl text-gray-900 mt-1">{isClient ? "Restricted" : `${data.kpis.budgetEfficiency.value}%`}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                      <TrendingDown className="w-3 h-3" />
                      {isClient ? "Not visible for clients" : data.kpis.budgetEfficiency.status}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* The rest of your component remains unchanged */}
          {/* NOTE: kept your charts and UI same */}
          <Tabs defaultValue="projects" className="space-y-6">
            <TabsList>
              <TabsTrigger value="projects">Project Performance</TabsTrigger>
              {!isClient ? <TabsTrigger value="team">Team Analytics</TabsTrigger> : null}
              {isAdminOrPM ? <TabsTrigger value="budget">Budget & Resources</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="projects" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Project Completion Trend</CardTitle>
                    <CardDescription>Completed vs In-Progress projects over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={data.charts.completionTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="completed" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                        <Area type="monotone" dataKey="inProgress" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Task Velocity</CardTitle>
                    <CardDescription>Planned vs Completed tasks per week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.charts.taskVelocity}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="planned" fill="#94a3b8" />
                        <Bar dataKey="completed" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {!isClient ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Time Distribution by Category</CardTitle>
                    <CardDescription>From Time Entries grouped by task.category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-8">
                      <ResponsiveContainer width="40%" height={300}>
                        <PieChart>
                          <Pie data={timeDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="hours">
                            {timeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={(entry as any).color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="flex-1 space-y-3">
                        {timeDistribution.map((item: any) => (
                          <div key={item.category} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
                              <span className="text-gray-900">{item.category}</span>
                            </div>
                            <span className="text-gray-600">{item.hours} hours</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {!isClient ? (
              <TabsContent value="team" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Team Productivity Scores</CardTitle>
                    <CardDescription>Done tasks / total assigned tasks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.charts.productivityByMember}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="userId" hide />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="productivity" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}

            {isAdminOrPM ? (
              <TabsContent value="budget" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Budget Allocation & Usage</CardTitle>
                    <CardDescription>From Project.budget.allocated and Project.budget.spent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {data.charts.budgetByProject.map((project) => (
                        <div key={project.project} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900">{project.project}</span>
                            <span className="text-sm text-gray-600">
                              ${project.spent.toLocaleString()} / ${project.allocated.toLocaleString()}
                            </span>
                          </div>

                          <div className="w-full bg-gray-100 rounded-full h-3">
                            <div
                              className={`h-full rounded-full ${
                                project.percentage > 90 ? "bg-red-600" : project.percentage > 75 ? "bg-yellow-600" : "bg-green-600"
                              }`}
                              style={{ width: `${project.percentage}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{project.percentage}% spent</span>
                            <span>${(project.allocated - project.spent).toLocaleString()} remaining</span>
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

