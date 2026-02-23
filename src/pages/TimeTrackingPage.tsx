import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Pause,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Download,
  Trash2,
  FileCheck2,
  RefreshCw,
  Eye,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Role = "admin" | "project-manager" | "team-member" | "client";

type Me = {
  _id: string;
  name: string;
  email: string;
  role: Role;
};

type TaskLite = {
  _id: string;
  title: string;
  projectId: string;
  projectName?: string;
};

type TimeEntryStatus = "draft" | "pending" | "approved" | "rejected";

type TimeEntry = {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  durationSeconds: number;
  notes?: string;
  status: TimeEntryStatus;

  taskId:
    | string
    | {
        _id: string;
        title: string;
        status?: string;
        priority?: string;
      };
  projectId:
    | string
    | {
        _id: string;
        name: string;
        status?: string;
      };
  createdAt?: string;
};

type TodaySummary = {
  date: string;
  totalSeconds: number;
  tasksTracked: number;
  projectsTracked: number;
  breakdown: Record<string, number>;
};

type Timesheet = {
  id: string | null;
  _id?: string;

  weekStart: string;
  weekEnd: string;
  totalSeconds: number;
  totalHours: number;
  count: number;
  status: "draft" | "pending" | "approved" | "rejected";
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewComment?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatHMS(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekSunday(date: Date) {
  const s = startOfWeekMonday(date);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function weekLabelFromISO(weekStartISO: string) {
  const ws = new Date(weekStartISO + "T00:00:00");
  const we = endOfWeekSunday(ws);

  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = ws.toLocaleDateString(undefined, opts);
  const e = we.toLocaleDateString(undefined, opts);
  const y = we.getFullYear();
  return `${s} - ${e}, ${y}`;
}

function exportEntriesAsPDF(entries: TimeEntry[]) {
  const rows = entries
    .map((e) => {
      const taskTitle =
        typeof e.taskId === "string" ? "Task" : (e.taskId as any)?.title;
      const projectName =
        typeof e.projectId === "string" ? "Project" : (e.projectId as any)?.name;

      return `
        <tr>
          <td>${e.date}</td>
          <td>${projectName}</td>
          <td>${taskTitle}</td>
          <td>${formatHMS(e.durationSeconds)}</td>
          <td>${e.status}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
  <html>
    <head>
      <title>TaskFlow - Recent Time Entries</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { margin: 0 0 6px 0; }
        p { margin: 0 0 16px 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 10px; font-size: 12px; }
        th { background: #f5f5f5; text-align: left; }
        .meta { font-size: 12px; color: #666; margin-top: 8px; }
      </style>
    </head>
    <body>
      <h1>Recent Time Entries</h1>
      <p>Exported from TaskFlow</p>
      <div class="meta">Generated on: ${new Date().toLocaleString()}</div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Project</th>
            <th>Task</th>
            <th>Duration</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="5">No entries found</td></tr>`}
        </tbody>
      </table>

      <script>
        window.onload = () => window.print();
      </script>
    </body>
  </html>
  `;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Popup blocked. Allow popups to export PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function getTimesheetId(ts: any): string | null {
  return ts?.id || ts?._id || null;
}

export function TimeTrackingPage() {
  const [me, setMe] = useState<Me | null>(null);
  const role: Role | null = me?.role ?? null;
  const canReview = role === "admin" || role === "project-manager";

  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  const [isTracking, setIsTracking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [saving, setSaving] = useState(false);

  const startTsRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);

  const [openDetails, setOpenDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState("");
  const [detailsEntries, setDetailsEntries] = useState<TimeEntry[]>([]);

  const [loading, setLoading] = useState({
    page: true,
    tasks: true,
    entries: true,
    summary: true,
    timesheets: true,
  });

  const todayISO = useMemo(() => toISODate(new Date()), []);

  useEffect(() => {
    if (!isTracking) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }

    tickRef.current = window.setInterval(() => {
      if (!startTsRef.current) return;
      const diffSec = Math.floor((Date.now() - startTsRef.current) / 1000);
      setElapsedSeconds(diffSec);
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [isTracking]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading((p) => ({ ...p, page: true }));

        // ✅ baseURL="/api" so this hits "/api/me"
        const meRes = await api.get<Me>("/me");
        setMe(meRes.data);

        await loadTasks();
        await Promise.all([loadEntries(), loadTodaySummary(), loadTimesheets()]);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Failed to load time tracking data");
      } finally {
        setLoading((p) => ({ ...p, page: false }));
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTasks = async () => {
    try {
      setLoading((p) => ({ ...p, tasks: true }));

      // GET /api/projects
      const pRes = await api.get<{ projects: any[] }>("/projects");
      const projects = pRes.data.projects || [];

      const all: TaskLite[] = [];

      for (const p of projects) {
        const projectId = p._id;
        const projectName = p.name;

        try {
          // ✅ GET /api/projects/:id/tasks
          const tRes = await api.get<{ tasks: any[] }>(`/projects/${projectId}/tasks`);
          const tlist = (tRes.data.tasks || []).map((t: any) => ({
            _id: t._id,
            title: t.title,
            projectId,
            projectName,
          }));
          all.push(...tlist);
        } catch {
          // skip restricted projects
        }
      }

      setTasks(all);
      if (!selectedTaskId && all.length === 1) setSelectedTaskId(all[0]._id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to load tasks");
    } finally {
      setLoading((p) => ({ ...p, tasks: false }));
    }
  };

  const loadEntries = async () => {
    try {
      setLoading((p) => ({ ...p, entries: true }));
      // GET /api/time-entries
      const res = await api.get<{ entries: TimeEntry[] }>("/time-entries");
      setEntries(res.data.entries || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to load time entries");
    } finally {
      setLoading((p) => ({ ...p, entries: false }));
    }
  };

  const loadTodaySummary = async () => {
    try {
      setLoading((p) => ({ ...p, summary: true }));
      // GET /api/time-entries/summary/today
      const res = await api.get<TodaySummary>("/time-entries/summary/today");
      setTodaySummary(res.data);
    } catch {
      setTodaySummary(null);
    } finally {
      setLoading((p) => ({ ...p, summary: false }));
    }
  };

  const loadTimesheets = async () => {
    try {
      setLoading((p) => ({ ...p, timesheets: true }));
      // GET /api/timesheets
      const res = await api.get<{ timesheets: any[] }>("/timesheets");

      const normalized: Timesheet[] = (res.data.timesheets || []).map((ts: any) => ({
        ...ts,
        id: getTimesheetId(ts),
      }));

      setTimesheets(normalized);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to load timesheets");
    } finally {
      setLoading((p) => ({ ...p, timesheets: false }));
    }
  };

  const recentEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
      const db = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
      return db - da;
    });
    return sorted;
  }, [entries]);

  const summaryDisplay = useMemo(() => {
    if (todaySummary) return todaySummary;

    const todays = entries.filter((e) => e.date === todayISO);
    const totalSeconds = todays.reduce((s, e) => s + (e.durationSeconds || 0), 0);

    const tasksTracked = new Set(
      todays.map((e) => (typeof e.taskId === "string" ? e.taskId : e.taskId?._id))
    ).size;

    const projectsTracked = new Set(
      todays.map((e) => (typeof e.projectId === "string" ? e.projectId : e.projectId?._id))
    ).size;

    const breakdown: Record<string, number> = {};
    for (const e of todays) {
      const pid = typeof e.projectId === "string" ? e.projectId : e.projectId?._id;
      if (!pid) continue;
      breakdown[pid] = (breakdown[pid] || 0) + e.durationSeconds;
    }

    return { date: todayISO, totalSeconds, tasksTracked, projectsTracked, breakdown };
  }, [todaySummary, entries, todayISO]);

  const breakdownRows = useMemo(() => {
    const breakdown = summaryDisplay?.breakdown || {};
    const pidToName = new Map<string, string>();

    for (const e of entries) {
      const pid = typeof e.projectId === "string" ? e.projectId : e.projectId?._id;
      const name = typeof e.projectId === "string" ? undefined : (e.projectId as any)?.name;
      if (pid && name) pidToName.set(pid, name);
    }

    return Object.entries(breakdown).map(([projectId, sec]) => ({
      projectId,
      projectName: pidToName.get(projectId) || "Project",
      sec,
    }));
  }, [summaryDisplay, entries]);

  const handleStartStop = async () => {
    if (saving) return;

    if (!isTracking) {
      if (!selectedTaskId) {
        toast.error("Please select a task first");
        return;
      }
      startTsRef.current = Date.now();
      setElapsedSeconds(0);
      setIsTracking(true);
      toast.success("Time tracking started");
      return;
    }

    const start = startTsRef.current;
    if (!start) {
      setIsTracking(false);
      setElapsedSeconds(0);
      toast.error("Timer invalid. Please start again.");
      return;
    }

    const durationSeconds = Math.max(0, Math.floor((Date.now() - start) / 1000));

    setIsTracking(false);
    startTsRef.current = null;

    if (durationSeconds <= 0) {
      setElapsedSeconds(0);
      toast.error("Tracked time is too short. Try again.");
      return;
    }

    try {
      setSaving(true);

      // POST /api/time-entries
      await api.post("/time-entries", {
        taskId: selectedTaskId,
        durationSeconds,
        date: toISODate(new Date()),
      });

      toast.success("Time entry saved");
      setElapsedSeconds(0);
      await Promise.all([loadEntries(), loadTodaySummary(), loadTimesheets()]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to save time entry");
      setElapsedSeconds(0);
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      // ✅ DELETE /api/time-entries/:id
      await api.delete(`/time-entries/${id}`);
      toast.success("Entry deleted");
      await Promise.all([loadEntries(), loadTodaySummary(), loadTimesheets()]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to delete entry");
    }
  };

  const submitCurrentWeek = async () => {
    try {
      const ws = toISODate(startOfWeekMonday(new Date()));
      // POST /api/timesheets/submit
      await api.post("/timesheets/submit", { weekStart: ws });
      toast.success("Timesheet submitted");
      await loadTimesheets();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to submit timesheet");
    }
  };

  const reviewTimesheet = async (timesheetId: string, action: "approved" | "rejected") => {
    try {
      // PATCH /api/timesheets/:id/review
      await api.patch(`/timesheets/${timesheetId}/review`, { action });
      toast.success(`Timesheet ${action}`);
      await loadTimesheets();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to review timesheet");
    }
  };

  const openTimesheetDetails = async (weekStart: string, weekEnd: string) => {
    try {
      setOpenDetails(true);
      setDetailsLoading(true);
      setDetailsTitle(weekLabelFromISO(weekStart));

      // GET /api/time-entries?from=...&to=...
      const res = await api.get<{ entries: TimeEntry[] }>(
        `/time-entries?from=${encodeURIComponent(weekStart)}&to=${encodeURIComponent(weekEnd)}`
      );

      setDetailsEntries(res.data.entries || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to load timesheet details");
      setDetailsEntries([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Time Tracking</h1>
          <p className="text-gray-600">Track time spent on tasks and manage timesheets</p>
          <div className="mt-2 text-sm text-gray-500">
            {me ? (
              <>
                Logged in as <span className="text-gray-900">{me.name}</span>{" "}
                (<span className="text-gray-900">{me.role}</span>)
              </>
            ) : (
              "Loading user..."
            )}
          </div>
        </div>

        <Button
          variant="outline"
          onClick={async () => {
            await Promise.all([loadTasks(), loadEntries(), loadTodaySummary(), loadTimesheets()]);
            toast.success("Refreshed");
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="timer" className="space-y-6">
        <TabsList>
          <TabsTrigger value="timer">Timer</TabsTrigger>
          <TabsTrigger value="recent">Recent Entries</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
        </TabsList>

        <TabsContent value="timer" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Time Tracker</CardTitle>
                <CardDescription>Start tracking time for your current task</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="flex items-center justify-center py-8">
                  <div className={`text-6xl font-mono ${isTracking ? "text-blue-600" : "text-gray-900"}`}>
                    {formatHMS(elapsedSeconds)}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-600">Select Task</label>
                    <Select
                      value={selectedTaskId}
                      onValueChange={(val) => {
                        if (isTracking || saving) {
                          toast.error("Stop tracking before changing the task");
                          return;
                        }
                        setSelectedTaskId(val);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loading.tasks ? "Loading tasks..." : "Choose a task to track..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {tasks.length === 0 && (
                          <SelectItem value="__none" disabled>
                            No tasks available
                          </SelectItem>
                        )}
                        {tasks.map((t) => (
                          <SelectItem key={t._id} value={t._id}>
                            {t.title} - {t.projectName || "Project"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleStartStop}
                    className="w-full"
                    size="lg"
                    disabled={saving}
                    variant={isTracking ? "destructive" : "default"}
                  >
                    {isTracking ? (
                      <>
                        <Pause className="w-5 h-5 mr-2" />
                        Stop Tracking
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        {saving ? "Saving..." : "Start Tracking"}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Today's Summary</CardTitle>
                <CardDescription>{new Date().toLocaleDateString()}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Time</span>
                    <span className="text-lg text-gray-900">{formatHMS(summaryDisplay?.totalSeconds || 0)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Tasks Tracked</span>
                    <span className="text-lg text-gray-900">{summaryDisplay?.tasksTracked || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Projects</span>
                    <span className="text-lg text-gray-900">{summaryDisplay?.projectsTracked || 0}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 space-y-3">
                  <h4 className="text-sm text-gray-900">Breakdown</h4>
                  <div className="space-y-2">
                    {breakdownRows.length === 0 ? (
                      <div className="text-sm text-gray-500">No entries logged today.</div>
                    ) : (
                      breakdownRows.map((b) => (
                        <div key={b.projectId} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{b.projectName}</span>
                          <span className="text-gray-900">{formatHMS(b.sec)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Recent Time Entries</CardTitle>
                  <CardDescription>Your latest tracked activities</CardDescription>
                </div>

                <Button variant="outline" onClick={() => exportEntriesAsPDF(recentEntries)}>
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {recentEntries.length === 0 ? (
                  <div className="text-sm text-gray-500">No time entries yet.</div>
                ) : (
                  recentEntries.map((entry) => {
                    const taskTitle =
                      typeof entry.taskId === "string" ? "Task" : (entry.taskId as any)?.title;

                    const projectName =
                      typeof entry.projectId === "string" ? "Project" : (entry.projectId as any)?.name;

                    return (
                      <div
                        key={entry._id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="flex-1">
                          <h4 className="text-gray-900">{taskTitle}</h4>
                          <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {entry.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatHMS(entry.durationSeconds)}
                            </span>
                            <Badge variant="outline">{projectName}</Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{entry.status}</Badge>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toast.info(`Task: ${taskTitle}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => deleteEntry(entry._id)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timesheets">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Timesheets</CardTitle>
                  <CardDescription>Submit and manage your weekly timesheets</CardDescription>
                </div>

                <Button onClick={submitCurrentWeek}>
                  <FileCheck2 className="w-4 h-4 mr-2" />
                  Submit Current Week
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {timesheets.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No timesheets found yet. Submit the current week to create one.
                  </div>
                ) : (
                  timesheets.map((ts) => {
                    const tsId = getTimesheetId(ts);

                    const badgeVariant =
                      ts.status === "approved"
                        ? "default"
                        : ts.status === "pending"
                        ? "secondary"
                        : ts.status === "rejected"
                        ? "destructive"
                        : "outline";

                    return (
                      <div key={tsId || ts.weekStart} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-gray-900">{weekLabelFromISO(ts.weekStart)}</h4>

                              <Badge variant={badgeVariant}>
                                {ts.status === "approved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                {ts.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                                {ts.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Total Hours:</span>
                                <span className="text-gray-900 ml-1">{ts.totalHours}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Entries:</span>
                                <span className="text-gray-900 ml-1">{ts.count}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Week Start:</span>
                                <span className="text-gray-900 ml-1">{ts.weekStart}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Week End:</span>
                                <span className="text-gray-900 ml-1">{ts.weekEnd}</span>
                              </div>
                            </div>

                            {canReview && ts.status === "pending" && (
                              <div className="mt-4 flex gap-2">
                                <Button disabled={!tsId} onClick={() => tsId && reviewTimesheet(tsId, "approved")}>
                                  Approve
                                </Button>
                                <Button
                                  disabled={!tsId}
                                  variant="destructive"
                                  onClick={() => tsId && reviewTimesheet(tsId, "rejected")}
                                >
                                  Reject
                                </Button>

                                {!tsId && (
                                  <div className="text-xs text-gray-500 self-center">
                                    Backend must return timesheet id (_id or id) in GET /api/timesheets
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <Button variant="ghost" size="sm" onClick={() => openTimesheetDetails(ts.weekStart, ts.weekEnd)}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Dialog open={openDetails} onOpenChange={setOpenDetails}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Timesheet Details</DialogTitle>
                <DialogDescription>{detailsTitle}</DialogDescription>
              </DialogHeader>

              {detailsLoading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {detailsEntries.length === 0 ? (
                    <div className="text-sm text-gray-500">No entries in this week.</div>
                  ) : (
                    detailsEntries.map((e) => {
                      const taskTitle =
                        typeof e.taskId === "string" ? "Task" : (e.taskId as any)?.title;
                      const projectName =
                        typeof e.projectId === "string" ? "Project" : (e.projectId as any)?.name;

                      return (
                        <div key={e._id} className="p-3 border border-gray-200 rounded-lg">
                          <div className="text-gray-900">{taskTitle}</div>
                          <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-3">
                            <span>{e.date}</span>
                            <span>{formatHMS(e.durationSeconds)}</span>
                            <Badge variant="outline">{projectName}</Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
