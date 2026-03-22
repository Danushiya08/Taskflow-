import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { formatDateByPreference } from "@/lib/dateFormat";
import { formatCurrency, formatCompactCurrency } from "@/lib/currency";
import { mapTimezonePreference } from "@/lib/timezone";

type BreakdownItem = { category: string; amount: number; percentage: number };

type ProjectBudget = {
  _id: string;
  name: string;
  budget?: {
    allocated?: number;
    spent?: number;
  };
  breakdown?: BreakdownItem[];
};

type Expense = {
  _id: string;
  description: string;
  projectName?: string;
  projectId?: string;
  category?: string;
  amount: number;
  date?: string;
  approvedByName?: string;
};

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--card-foreground))",
  borderRadius: "8px",
};

export function BudgetPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  const [projects, setProjects] = useState<ProjectBudget[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [monthlySpending, setMonthlySpending] = useState<{ month: string; amount: number }[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<
    { name: string; value: number; color: string }[]
  >([]);

  const [loading, setLoading] = useState({
    projects: true,
    expenses: true,
    analytics: true,
    adding: false,
    exporting: false,
  });

  const { preferences, loadingPreferences } = useUserPreferences();
  const compactMode = preferences.compactMode;

  const timezone = useMemo(
    () => mapTimezonePreference(preferences.timezone),
    [preferences.timezone]
  );

  const [form, setForm] = useState({
    description: "",
    amount: "",
    projectId: "",
    category: "",
    date: "",
    notes: "",
  });

  const pagePadding = compactMode ? "p-4" : "p-6";
  const sectionSpacing = compactMode ? "space-y-4" : "space-y-6";
  const titleClass = compactMode ? "text-2xl font-semibold mb-1" : "text-3xl font-semibold mb-2";
  const subtitleClass = compactMode ? "text-sm text-muted-foreground" : "text-muted-foreground";
  const topGap = compactMode ? "gap-3" : "gap-4";
  const actionGap = compactMode ? "gap-2" : "gap-3";
  const gridGap = compactMode ? "gap-3" : "gap-4";
  const chartGridGap = compactMode ? "gap-4" : "gap-6";
  const cardHeaderPadding = compactMode ? "pb-2" : "pb-4";
  const cardTopPadding = compactMode ? "pt-4" : "pt-6";
  const cardTitleClass = compactMode ? "text-base" : "text-lg";
  const metricLabelClass = compactMode ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground";
  const metricValueClass = compactMode ? "text-xl font-semibold mt-1" : "text-2xl font-semibold mt-1";
  const helperTextClass = compactMode ? "text-[11px] text-muted-foreground mt-1" : "text-xs text-muted-foreground mt-1";
  const buttonCompactClass = compactMode ? "h-9 px-3" : "";
  const selectTriggerCompactClass = compactMode ? "h-9" : "";
  const dialogFieldSpacing = compactMode ? "space-y-3 py-2" : "space-y-4 py-4";
  const dialogGridGap = compactMode ? "gap-3" : "gap-4";
  const textareaRows = compactMode ? 2 : 3;
  const progressHeight = compactMode ? "h-2" : "h-3";
  const listSpacing = compactMode ? "space-y-2.5" : "space-y-3";
  const expenseRowPadding = compactMode ? "p-3" : "p-4";
  const chartHeight = compactMode ? 240 : 300;
  const chartWrapperMinHeight = compactMode ? 260 : 320;
  const pieOuterRadius = compactMode ? 80 : 100;

  const resetForm = () =>
    setForm({
      description: "",
      amount: "",
      projectId: "",
      category: "",
      date: "",
      notes: "",
    });

  const loadProjects = async () => {
    try {
      setLoading((p) => ({ ...p, projects: true }));
      const res = await api.get<{ projects: ProjectBudget[] }>("/budget/projects");
      setProjects(res.data.projects || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to load project budgets");
      setProjects([]);
    } finally {
      setLoading((p) => ({ ...p, projects: false }));
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading((p) => ({ ...p, expenses: true }));
      const res = await api.get<{ expenses: Expense[] }>("/budget/expenses?limit=50");
      setRecentExpenses(res.data.expenses || []);
    } catch {
      setRecentExpenses([]);
    } finally {
      setLoading((p) => ({ ...p, expenses: false }));
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading((p) => ({ ...p, analytics: true }));
      const res = await api.get<{
        monthlySpending: { month: string; amount: number }[];
        categoryDistribution: { name: string; value: number }[];
      }>("/budget/analytics?months=6");

      setMonthlySpending(res.data.monthlySpending || []);

      const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#6b7280", "#94a3b8"];
      const dist = (res.data.categoryDistribution || []).map((x, idx) => ({
        ...x,
        color: COLORS[idx % COLORS.length],
      }));
      setCategoryDistribution(dist);
    } catch {
      setMonthlySpending([]);
      setCategoryDistribution([]);
    } finally {
      setLoading((p) => ({ ...p, analytics: false }));
    }
  };

  const reloadAll = async () => {
    await Promise.all([loadProjects(), loadExpenses(), loadAnalytics()]);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  const handleAddExpense = async () => {
    try {
      if (!form.projectId) return toast.error("Please select a project");
      if (!form.category) return toast.error("Please select a category");
      const amt = Number(form.amount);
      if (!amt || amt <= 0) return toast.error("Amount must be greater than 0");

      setLoading((p) => ({ ...p, adding: true }));

      await api.post("/budget/expenses", {
        projectId: form.projectId,
        description: form.description,
        category: form.category,
        amount: amt,
        date: form.date || undefined,
        notes: form.notes,
      });

      toast.success("Expense added successfully!");
      setIsAddExpenseOpen(false);
      resetForm();
      await reloadAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to add expense");
    } finally {
      setLoading((p) => ({ ...p, adding: false }));
    }
  };

  const handleExport = async () => {
    try {
      setLoading((p) => ({ ...p, exporting: true }));

      const res = await api.get("/budget/export?format=pdf&months=12", {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `budget_report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);

      toast.success("PDF report exported!");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Export failed");
    } finally {
      setLoading((p) => ({ ...p, exporting: false }));
    }
  };

  const computedProjects = useMemo(() => {
    return (projects || []).map((p) => {
      const allocated = Number(p.budget?.allocated || 0);
      const spent = Number(p.budget?.spent || 0);
      const remaining = Math.max(0, allocated - spent);

      const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;

      const status =
        allocated === 0
          ? "on-track"
          : pct > 90
          ? "at-risk"
          : pct < 50
          ? "under-budget"
          : "on-track";

      const breakdown = Array.isArray(p.breakdown) ? p.breakdown : [];

      return {
        id: p._id,
        name: p.name,
        budget: allocated,
        spent,
        remaining,
        status,
        forecastedTotal: spent,
        expenses: breakdown.map((x) => ({
          category: x.category,
          amount: Number(x.amount || 0),
          percentage: Number(x.percentage || 0),
        })),
      };
    });
  }, [projects]);

  const totalBudget = computedProjects.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = computedProjects.reduce((sum, p) => sum + p.spent, 0);
  const totalRemaining = computedProjects.reduce((sum, p) => sum + p.remaining, 0);
  const utilizationRate = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const filteredProjects = computedProjects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const atRiskCount = computedProjects.filter(
    (p) => p.budget > 0 && (p.spent / p.budget) * 100 > 90
  ).length;

  if (loadingPreferences) {
    return (
      <div className={`${pagePadding} bg-background text-foreground`}>
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={`${cardTopPadding} text-muted-foreground`}>
            Loading budget page...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${pagePadding} ${sectionSpacing} bg-background text-foreground`}>
      <div className={`flex items-center justify-between flex-wrap ${topGap}`}>
        <div>
          <h1 className={titleClass}>Budget Management</h1>
          <p className={subtitleClass}>Track expenses, allocations, and financial forecasts</p>
        </div>

        <div className={`flex flex-wrap ${actionGap}`}>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={loading.exporting}
            className={buttonCompactClass}
          >
            <Download className="w-4 h-4 mr-2" />
            {loading.exporting ? "Exporting..." : "Export Report"}
          </Button>

          <Dialog
            open={isAddExpenseOpen}
            onOpenChange={(v) => {
              setIsAddExpenseOpen(v);
              if (!v) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className={buttonCompactClass}>
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>

            <DialogContent className="border-border bg-card text-card-foreground">
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>Record a new project expense</DialogDescription>
              </DialogHeader>

              <div className={dialogFieldSpacing}>
                <div className="space-y-2">
                  <Label htmlFor="expense-description">Description</Label>
                  <Input
                    id="expense-description"
                    placeholder="e.g., Cloud hosting - December"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className={selectTriggerCompactClass}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-amount">
                    Amount ({preferences.currency?.toUpperCase?.() || "USD"})
                  </Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    placeholder="1000"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    className={selectTriggerCompactClass}
                  />
                </div>

                <div className={`grid grid-cols-2 ${dialogGridGap}`}>
                  <div className="space-y-2">
                    <Label htmlFor="expense-project">Project</Label>
                    <Select
                      value={form.projectId}
                      onValueChange={(v) => setForm((p) => ({ ...p, projectId: v }))}
                    >
                      <SelectTrigger id="expense-project" className={selectTriggerCompactClass}>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {(projects || []).map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expense-category">Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
                    >
                      <SelectTrigger id="expense-category" className={selectTriggerCompactClass}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Development">Development</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                        <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                        <SelectItem value="Advertising">Advertising</SelectItem>
                        <SelectItem value="Testing">Testing</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-date">Date</Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className={selectTriggerCompactClass}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-notes">Notes (Optional)</Label>
                  <Textarea
                    id="expense-notes"
                    placeholder="Additional details..."
                    rows={textareaRows}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddExpenseOpen(false)}
                  disabled={loading.adding}
                  className={buttonCompactClass}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddExpense}
                  disabled={loading.adding}
                  className={buttonCompactClass}
                >
                  {loading.adding ? "Adding..." : "Add Expense"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-4 ${gridGap}`}>
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPadding}>
            <div className="flex items-center justify-between">
              <div>
                <p className={metricLabelClass}>Total Budget</p>
                <p className={metricValueClass}>
                  {formatCompactCurrency(totalBudget, preferences.currency)}
                </p>
              </div>
              <DollarSign className={compactMode ? "w-7 h-7 text-blue-600" : "w-8 h-8 text-blue-600"} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPadding}>
            <div className="flex items-center justify-between">
              <div>
                <p className={metricLabelClass}>Total Spent</p>
                <p className={metricValueClass}>
                  {formatCompactCurrency(totalSpent, preferences.currency)}
                </p>
                <p className={helperTextClass}>{utilizationRate}% utilized</p>
              </div>
              <TrendingUp className={compactMode ? "w-7 h-7 text-green-600" : "w-8 h-8 text-green-600"} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPadding}>
            <div className="flex items-center justify-between">
              <div>
                <p className={metricLabelClass}>Remaining</p>
                <p className={metricValueClass}>
                  {formatCompactCurrency(totalRemaining, preferences.currency)}
                </p>
                <p className={helperTextClass}>{Math.max(0, 100 - utilizationRate)}% available</p>
              </div>
              <TrendingDown className={compactMode ? "w-7 h-7 text-purple-600" : "w-8 h-8 text-purple-600"} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPadding}>
            <div className="flex items-center justify-between">
              <div>
                <p className={metricLabelClass}>At Risk</p>
                <p className={metricValueClass}>{atRiskCount}</p>
                <p className={helperTextClass}>Project over 90%</p>
              </div>
              <AlertTriangle className={compactMode ? "w-7 h-7 text-yellow-600" : "w-8 h-8 text-yellow-600"} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="projects" className={sectionSpacing}>
        <TabsList className={compactMode ? "h-9" : ""}>
          <TabsTrigger value="projects">Project Budgets</TabsTrigger>
          <TabsTrigger value="expenses">Recent Expenses</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className={compactMode ? "space-y-3" : "space-y-4"}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects..."
              className={`pl-10 ${selectTriggerCompactClass}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {loading.projects ? (
            <Card className="border-border bg-card text-card-foreground">
              <CardContent className={`${cardTopPadding} text-muted-foreground`}>
                Loading budgets...
              </CardContent>
            </Card>
          ) : filteredProjects.length === 0 ? (
            <Card className="border-border bg-card text-card-foreground">
              <CardContent className={`${cardTopPadding} text-muted-foreground`}>
                No projects found.
              </CardContent>
            </Card>
          ) : (
            filteredProjects.map((project) => {
              const percentageUsed =
                project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0;
              const isOverBudget = project.budget > 0 && project.forecastedTotal > project.budget;
              const expenseBreakdown = Array.isArray(project.expenses) ? project.expenses : [];

              return (
                <Card
                  key={project.id}
                  className="border-border bg-card text-card-foreground hover:shadow-lg transition-shadow"
                >
                  <CardHeader className={cardHeaderPadding}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className={cardTitleClass}>{project.name}</CardTitle>
                      <Badge
                        variant={
                          project.status === "at-risk"
                            ? "destructive"
                            : project.status === "under-budget"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {project.status.replace("-", " ")}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className={compactMode ? "space-y-3" : "space-y-4"}>
                    <div className={`grid grid-cols-3 ${dialogGridGap} text-sm`}>
                      <div>
                        <p className="text-muted-foreground">Budget</p>
                        <p className={compactMode ? "text-base font-medium text-card-foreground" : "text-lg font-medium text-card-foreground"}>
                          {formatCurrency(project.budget, preferences.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Spent</p>
                        <p className={compactMode ? "text-base font-medium text-card-foreground" : "text-lg font-medium text-card-foreground"}>
                          {formatCurrency(project.spent, preferences.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className={compactMode ? "text-base font-medium text-card-foreground" : "text-lg font-medium text-card-foreground"}>
                          {formatCurrency(project.remaining, preferences.currency)}
                        </p>
                      </div>
                    </div>

                    <div className={compactMode ? "space-y-1.5" : "space-y-2"}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Budget Utilization</span>
                        <span className="text-card-foreground">{percentageUsed}%</span>
                      </div>
                      <Progress
                        value={percentageUsed}
                        className={`${progressHeight} ${
                          percentageUsed > 90 ? "bg-red-100 dark:bg-red-950" : ""
                        }`}
                      />
                    </div>

                    {isOverBudget && (
                      <div
                        className={`${
                          compactMode ? "p-2.5" : "p-3"
                        } bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg flex items-start gap-2`}
                      >
                        <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-yellow-900 dark:text-yellow-200">
                            Forecasted total:{" "}
                            {formatCurrency(project.forecastedTotal, preferences.currency)}
                          </p>
                          <p className="text-yellow-700 dark:text-yellow-300">
                            Projected to exceed budget by{" "}
                            {formatCurrency(
                              project.forecastedTotal - project.budget,
                              preferences.currency
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-border">
                      <h4 className="text-sm font-medium text-card-foreground mb-3">
                        Expense Breakdown
                      </h4>

                      {expenseBreakdown.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No expenses recorded yet.
                        </div>
                      ) : (
                        <div className={compactMode ? "space-y-1.5" : "space-y-2"}>
                          {expenseBreakdown.map((expense, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{expense.category}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-card-foreground">
                                  {formatCurrency(expense.amount, preferences.currency)}
                                </span>
                                <span className="text-muted-foreground">
                                  ({expense.percentage.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="expenses">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader className={cardHeaderPadding}>
              <CardTitle className={cardTitleClass}>Recent Expenses</CardTitle>
              <CardDescription>Latest transactions and purchases</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.expenses ? (
                <div className="text-sm text-muted-foreground">Loading expenses...</div>
              ) : recentExpenses.length === 0 ? (
                <div className="text-sm text-muted-foreground">No expenses recorded yet.</div>
              ) : (
                <div className={listSpacing}>
                  {recentExpenses.map((expense) => (
                    <div
                      key={expense._id}
                      className={`flex items-center justify-between ${expenseRowPadding} border border-border rounded-lg hover:border-primary/40 transition-colors`}
                    >
                      <div className="flex-1">
                        <h4
                          className={
                            compactMode
                              ? "text-sm font-medium text-card-foreground"
                              : "text-card-foreground font-medium"
                          }
                        >
                          {expense.description || "-"}
                        </h4>
                        <div
                          className={`flex items-center ${
                            compactMode ? "gap-3" : "gap-4"
                          } mt-1 text-sm text-muted-foreground flex-wrap`}
                        >
                          <Badge variant="outline">{expense.projectName || "Project"}</Badge>
                          <Badge variant="secondary">{expense.category || "Category"}</Badge>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDateByPreference(
                              expense.date,
                              preferences.dateFormat,
                              timezone
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={
                            compactMode
                              ? "text-base font-medium text-card-foreground"
                              : "text-lg font-medium text-card-foreground"
                          }
                        >
                          {formatCurrency(Number(expense.amount || 0), preferences.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Approved by {expense.approvedByName || "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className={sectionSpacing}>
          <div className={`grid grid-cols-1 lg:grid-cols-2 ${chartGridGap}`}>
            <Card className="border-border bg-card text-card-foreground">
              <CardHeader className={cardHeaderPadding}>
                <CardTitle className={cardTitleClass}>Monthly Spending Trend</CardTitle>
                <CardDescription>Total expenses per month</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ width: "100%", minHeight: chartWrapperMinHeight }}>
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <LineChart data={monthlySpending}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value: number) =>
                          formatCurrency(Number(value || 0), preferences.currency)
                        }
                      />
                      <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {loading.analytics ? (
                  <div className="text-sm text-muted-foreground mt-3">Loading analytics...</div>
                ) : monthlySpending.length === 0 ? (
                  <div className="text-sm text-muted-foreground mt-3">No analytics yet.</div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground">
              <CardHeader className={cardHeaderPadding}>
                <CardTitle className={cardTitleClass}>Expense by Category</CardTitle>
                <CardDescription>Distribution of spending across categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ width: "100%", minHeight: chartWrapperMinHeight }}>
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) =>
                          `${name}: ${formatCurrency(Number(value), preferences.currency)}`
                        }
                        outerRadius={pieOuterRadius}
                        dataKey="value"
                      >
                        {categoryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value: number) =>
                          formatCurrency(Number(value || 0), preferences.currency)
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {loading.analytics ? (
                  <div className="text-sm text-muted-foreground mt-3">Loading analytics...</div>
                ) : categoryDistribution.length === 0 ? (
                  <div className="text-sm text-muted-foreground mt-3">
                    No category distribution yet.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}