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
  const [categoryDistribution, setCategoryDistribution] = useState<{ name: string; value: number; color: string }[]>(
    []
  );

  const [loading, setLoading] = useState({
    projects: true,
    expenses: true,
    analytics: true,
    adding: false,
    exporting: false,
  });

  const { preferences, loadingPreferences } = useUserPreferences();

  const [form, setForm] = useState({
    description: "",
    amount: "",
    projectId: "",
    category: "",
    date: "",
    notes: "",
  });

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

  const atRiskCount = computedProjects.filter((p) => p.budget > 0 && (p.spent / p.budget) * 100 > 90).length;

  if (loadingPreferences) {
    return (
      <div className="p-6 bg-background text-foreground">
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6 text-muted-foreground">Loading budget page...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Budget Management</h1>
          <p className="text-muted-foreground">Track expenses, allocations, and financial forecasts</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExport} disabled={loading.exporting}>
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
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>

            <DialogContent className="border-border bg-card text-card-foreground">
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>Record a new project expense</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-description">Description</Label>
                  <Input
                    id="expense-description"
                    placeholder="e.g., Cloud hosting - December"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-amount">Amount ($)</Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    placeholder="1000"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expense-project">Project</Label>
                    <Select value={form.projectId} onValueChange={(v) => setForm((p) => ({ ...p, projectId: v }))}>
                      <SelectTrigger id="expense-project">
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
                    <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                      <SelectTrigger id="expense-category">
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-notes">Notes (Optional)</Label>
                  <Textarea
                    id="expense-notes"
                    placeholder="Additional details..."
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddExpenseOpen(false)} disabled={loading.adding}>
                  Cancel
                </Button>
                <Button onClick={handleAddExpense} disabled={loading.adding}>
                  {loading.adding ? "Adding..." : "Add Expense"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-semibold mt-1">{formatCompactCurrency(totalBudget)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-semibold mt-1">{formatCompactCurrency(totalSpent)}</p>
                <p className="text-xs text-muted-foreground mt-1">{utilizationRate}% utilized</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-semibold mt-1">{formatCompactCurrency(totalRemaining)}</p>
                <p className="text-xs text-muted-foreground mt-1">{Math.max(0, 100 - utilizationRate)}% available</p>
              </div>
              <TrendingDown className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">At Risk</p>
                <p className="text-2xl font-semibold mt-1">{atRiskCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Project over 90%</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList>
          <TabsTrigger value="projects">Project Budgets</TabsTrigger>
          <TabsTrigger value="expenses">Recent Expenses</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {loading.projects ? (
            <Card className="border-border bg-card text-card-foreground">
              <CardContent className="pt-6 text-muted-foreground">Loading budgets...</CardContent>
            </Card>
          ) : filteredProjects.length === 0 ? (
            <Card className="border-border bg-card text-card-foreground">
              <CardContent className="pt-6 text-muted-foreground">No projects found.</CardContent>
            </Card>
          ) : (
            filteredProjects.map((project) => {
              const percentageUsed = project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0;
              const isOverBudget = project.budget > 0 && project.forecastedTotal > project.budget;
              const expenseBreakdown = Array.isArray(project.expenses) ? project.expenses : [];

              return (
                <Card key={project.id} className="border-border bg-card text-card-foreground hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{project.name}</CardTitle>
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

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Budget</p>
                        <p className="text-lg font-medium text-card-foreground">{formatCurrency(project.budget)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Spent</p>
                        <p className="text-lg font-medium text-card-foreground">{formatCurrency(project.spent)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="text-lg font-medium text-card-foreground">{formatCurrency(project.remaining)}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Budget Utilization</span>
                        <span className="text-card-foreground">{percentageUsed}%</span>
                      </div>
                      <Progress value={percentageUsed} className={percentageUsed > 90 ? "bg-red-100 dark:bg-red-950" : ""} />
                    </div>

                    {isOverBudget && (
                      <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-yellow-900 dark:text-yellow-200">
                            Forecasted total: {formatCurrency(project.forecastedTotal)}
                          </p>
                          <p className="text-yellow-700 dark:text-yellow-300">
                            Projected to exceed budget by {formatCurrency(project.forecastedTotal - project.budget)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-border">
                      <h4 className="text-sm font-medium text-card-foreground mb-3">Expense Breakdown</h4>

                      {expenseBreakdown.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No expenses recorded yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {expenseBreakdown.map((expense, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{expense.category}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-card-foreground">{formatCurrency(expense.amount)}</span>
                                <span className="text-muted-foreground">({expense.percentage.toFixed(1)}%)</span>
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
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>Latest transactions and purchases</CardDescription>
            </CardHeader>
            <CardContent>
              {loading.expenses ? (
                <div className="text-sm text-muted-foreground">Loading expenses...</div>
              ) : recentExpenses.length === 0 ? (
                <div className="text-sm text-muted-foreground">No expenses recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {recentExpenses.map((expense) => (
                    <div
                      key={expense._id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/40 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="text-card-foreground font-medium">{expense.description || "-"}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <Badge variant="outline">{expense.projectName || "Project"}</Badge>
                          <Badge variant="secondary">{expense.category || "Category"}</Badge>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDateByPreference(expense.date, preferences.dateFormat)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-medium text-card-foreground">
                          {formatCurrency(Number(expense.amount || 0))}
                        </p>
                        <p className="text-xs text-muted-foreground">Approved by {expense.approvedByName || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border bg-card text-card-foreground">
              <CardHeader>
                <CardTitle>Monthly Spending Trend</CardTitle>
                <CardDescription>Total expenses per month</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ width: "100%", minHeight: 320 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlySpending}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={chartTooltipStyle} />
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
              <CardHeader>
                <CardTitle>Expense by Category</CardTitle>
                <CardDescription>Distribution of spending across categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ width: "100%", minHeight: 320 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${formatCurrency(Number(value))}`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {categoryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={(entry as any).color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {loading.analytics ? (
                  <div className="text-sm text-muted-foreground mt-3">Loading analytics...</div>
                ) : categoryDistribution.length === 0 ? (
                  <div className="text-sm text-muted-foreground mt-3">No category distribution yet.</div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}