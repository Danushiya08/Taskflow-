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

import { useUserPreferences } from "@/hooks/useUserPreferences";
import { formatDateByPreference } from "@/lib/dateFormat";
import { mapTimezonePreference } from "@/lib/timezone";

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
  date: string;
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

function getTimesheetId(ts: any): string | null {
  return ts?.id || ts?._id || null;
}

function exportEntriesAsPDF(
  entries: TimeEntry[],
  dateFormat: "mdy" | "dmy" | "ymd",
  timezone?: string
) {
  const rows = entries
    .map((e) => {
      const taskTitle =
        typeof e.taskId === "string" ? "Task" : (e.taskId as any)?.title;
      const projectName =
        typeof e.projectId === "string" ? "Project" : (e.projectId as any)?.name;

      return `
        <tr>
          <td>${formatDateByPreference(e.date, dateFormat, timezone)}</td>
          <td>${projectName}</td>
          <td>${taskTitle}</td>
          <td>${formatHMS(e.durationSeconds)}</td>
          <td>${e.status}</td>
        </tr>
      `;
    })
    .join("");

  const generatedOn = new Date().toLocaleString("en-US", {
    timeZone: timezone,
  });

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
      <div class="meta">Generated on: ${generatedOn}</div>

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

  const { preferences, loadingPreferences } = useUserPreferences();
  const compactMode = preferences.compactMode;
  const timezone = useMemo(
    () => mapTimezonePreference(preferences.timezone),
    [preferences.timezone]
  );

  const pagePadding = compactMode ? "p-4" : "p-6";
  const sectionSpacing = compactMode ? "space-y-4" : "space-y-6";
  const titleClass = compactMode ? "text-2xl font-semibold mb-1" : "text-3xl font-semibold mb-2";
  const subtitleClass = compactMode ? "text-sm text-muted-foreground" : "text-muted-foreground";
  const topGap = compactMode ? "gap-3" : "gap-4";
  const buttonCompactClass = compactMode ? "h-9 px-3" : "";
  const iconButtonCompactClass = compactMode ? "h-8 w-8 p-0" : "";
  const selectTriggerCompactClass = compactMode ? "h-9" : "";
  const tabsListCompactClass = compactMode ? "h-9" : "";
  const tabContentSpacing = compactMode ? "space-y-4" : "space-y-6";
  const gridGap = compactMode ? "gap-4" : "gap-6";
  const cardHeaderPadding = compactMode ? "pb-2" : "";
  const timerCardSpacing = compactMode ? "space-y-4" : "space-y-6";
  const timerDisplayPadding = compactMode ? "py-6" : "py-8";
  const timerTextClass = compactMode
    ? `text-5xl font-mono ${isTracking ? "text-primary" : "text-foreground"}`
    : `text-6xl font-mono ${isTracking ? "text-primary" : "text-foreground"}`;
  const summarySpacing = compactMode ? "space-y-3" : "space-y-4";
  const breakdownSpacing = compactMode ? "space-y-2.5" : "space-y-3";
  const entryListSpacing = compactMode ? "space-y-3" : "space-y-4";
  const entryRowPadding = compactMode ? "p-3" : "p-4";
  const metricTextClass = compactMode ? "text-base text-foreground" : "text-lg text-foreground";
  const helperTextClass = compactMode ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground";
  const timesheetRowPadding = compactMode ? "p-3" : "p-4";
  const timesheetMetaGap = compactMode ? "gap-3" : "gap-4";
  const detailsListSpacing = compactMode ? "space-y-2" : "space-y-3";
  const detailsRowPadding = compactMode ? "p-2.5" : "p-3";

  const todayISO = useMemo(() => toISODate(new Date()), []);

  function weekLabelFromISO(weekStartISO: string) {
    const ws = new Date(weekStartISO + "T00:00:00");
    const we = endOfWeekSunday(ws);

    const start = formatDateByPreference(toISODate(ws), preferences.dateFormat, timezone);
    const end = formatDateByPreference(toISODate(we), preferences.dateFormat, timezone);
    return `${start} - ${end}`;
  }

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
  }, []);

  const loadTasks = async () => {
    try {
      setLoading((p) => ({ ...p, tasks: true }));

      const pRes = await api.get<{ projects: any[] }>("/projects");
      const projects = pRes.data.projects || [];

      const all: TaskLite[] = [];

      for (const p of projects) {
        const projectId = p._id;
        const projectName = p.name;

        try {
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
      await api.post("/timesheets/submit", { weekStart: ws });
      toast.success("Timesheet submitted");
      await loadTimesheets();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to submit timesheet");
    }
  };

  const reviewTimesheet = async (timesheetId: string, action: "approved" | "rejected") => {
    try {
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

  if (loading.page || loadingPreferences) {
    return (
      <div className={`${pagePadding} space-y-2 bg-background text-foreground`}>
        <h1 className={compactMode ? "text-2xl font-semibold" : "text-3xl font-semibold"}>
          Time Tracking
        </h1>
        <p className={subtitleClass}>Loading...</p>
      </div>
    );
  }

  return (
    <div className={`${pagePadding} ${sectionSpacing} bg-background text-foreground`}>
      <div className={`flex items-start justify-between ${topGap} flex-wrap`}>
        <div>
          <h1 className={titleClass}>Time Tracking</h1>
          <p className={subtitleClass}>Track time spent on tasks and manage timesheets</p>
          <div className={`mt-2 ${helperTextClass}`}>
            {me ? (
              <>
                Logged in as <span className="text-foreground">{me.name}</span> (
                <span className="text-foreground">{me.role}</span>)
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
          className={buttonCompactClass}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="timer" className={tabContentSpacing}>
        <TabsList className={tabsListCompactClass}>
          <TabsTrigger value="timer">Timer</TabsTrigger>
          <TabsTrigger value="recent">Recent Entries</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
        </TabsList>

        <TabsContent value="timer" className={tabContentSpacing}>
          <div className={`grid grid-cols-1 lg:grid-cols-3 ${gridGap}`}>
            <Card className="lg:col-span-2 border-border bg-card text-card-foreground">
              <CardHeader className={cardHeaderPadding}>
                <CardTitle className={compactMode ? "text-base" : ""}>Time Tracker</CardTitle>
                <CardDescription>Start tracking time for your current task</CardDescription>
              </CardHeader>

              <CardContent className={timerCardSpacing}>
                <div className={`flex items-center justify-center ${timerDisplayPadding}`}>
                  <div className={timerTextClass}>{formatHMS(elapsedSeconds)}</div>
                </div>

                <div className={compactMode ? "space-y-3" : "space-y-4"}>
                  <div className="space-y-2">
                    <label className={helperTextClass}>Select Task</label>
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
                      <SelectTrigger className={selectTriggerCompactClass}>
                        <SelectValue
                          placeholder={loading.tasks ? "Loading tasks..." : "Choose a task to track..."}
                        />
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
                    className={`w-full ${buttonCompactClass}`}
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

            <Card className="border-border bg-card text-card-foreground">
              <CardHeader className={cardHeaderPadding}>
                <CardTitle className={compactMode ? "text-base" : ""}>Today's Summary</CardTitle>
                <CardDescription>
                  {formatDateByPreference(todayISO, preferences.dateFormat, timezone)}
                </CardDescription>
              </CardHeader>

              <CardContent className={summarySpacing}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={helperTextClass}>Total Time</span>
                    <span className={metricTextClass}>
                      {formatHMS(summaryDisplay?.totalSeconds || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={helperTextClass}>Tasks Tracked</span>
                    <span className={metricTextClass}>{summaryDisplay?.tasksTracked || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={helperTextClass}>Projects</span>
                    <span className={metricTextClass}>{summaryDisplay?.projectsTracked || 0}</span>
                  </div>
                </div>

                <div className={`pt-4 border-t border-border ${breakdownSpacing}`}>
                  <h4 className={compactMode ? "text-xs text-foreground" : "text-sm text-foreground"}>
                    Breakdown
                  </h4>
                  <div className="space-y-2">
                    {breakdownRows.length === 0 ? (
                      <div className={helperTextClass}>No entries logged today.</div>
                    ) : (
                      breakdownRows.map((b) => (
                        <div
                          key={b.projectId}
                          className={`flex items-center justify-between ${
                            compactMode ? "text-xs" : "text-sm"
                          }`}
                        >
                          <span className="text-muted-foreground">{b.projectName}</span>
                          <span className="text-foreground">{formatHMS(b.sec)}</span>
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
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader className={cardHeaderPadding}>
              <div className={`flex items-center justify-between ${topGap} flex-wrap`}>
                <div>
                  <CardTitle className={compactMode ? "text-base" : ""}>Recent Time Entries</CardTitle>
                  <CardDescription>Your latest tracked activities</CardDescription>
                </div>

                <Button
                  variant="outline"
                  onClick={() =>
                    exportEntriesAsPDF(
                      recentEntries,
                      preferences.dateFormat,
                      timezone
                    )
                  }
                  className={buttonCompactClass}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className={entryListSpacing}>
                {recentEntries.length === 0 ? (
                  <div className={helperTextClass}>No time entries yet.</div>
                ) : (
                  recentEntries.map((entry) => {
                    const taskTitle =
                      typeof entry.taskId === "string" ? "Task" : (entry.taskId as any)?.title;

                    const projectName =
                      typeof entry.projectId === "string" ? "Project" : (entry.projectId as any)?.name;

                    return (
                      <div
                        key={entry._id}
                        className={`flex items-center justify-between ${entryRowPadding} border border-border rounded-lg hover:border-primary/50 transition-colors bg-card`}
                      >
                        <div className="flex-1">
                          <h4 className={compactMode ? "text-sm text-foreground" : "text-foreground"}>
                            {taskTitle}
                          </h4>
                          <div
                            className={`flex flex-wrap items-center ${
                              compactMode ? "gap-3" : "gap-4"
                            } mt-1 ${helperTextClass}`}
                          >
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDateByPreference(entry.date, preferences.dateFormat, timezone)}
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
                              <Button variant="ghost" size="icon" className={iconButtonCompactClass}>
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
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader className={cardHeaderPadding}>
              <div className={`flex items-center justify-between ${topGap} flex-wrap`}>
                <div>
                  <CardTitle className={compactMode ? "text-base" : ""}>Timesheets</CardTitle>
                  <CardDescription>Submit and manage your weekly timesheets</CardDescription>
                </div>

                <Button onClick={submitCurrentWeek} className={buttonCompactClass}>
                  <FileCheck2 className="w-4 h-4 mr-2" />
                  Submit Current Week
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className={entryListSpacing}>
                {timesheets.length === 0 ? (
                  <div className={helperTextClass}>
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
                      <div
                        key={tsId || ts.weekStart}
                        className={`${timesheetRowPadding} border border-border rounded-lg bg-card`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className={`flex items-center ${compactMode ? "gap-2" : "gap-3"} mb-2 flex-wrap`}>
                              <h4 className={compactMode ? "text-sm text-foreground" : "text-foreground"}>
                                {weekLabelFromISO(ts.weekStart)}
                              </h4>

                              <Badge variant={badgeVariant}>
                                {ts.status === "approved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                {ts.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                                {ts.status}
                              </Badge>
                            </div>

                            <div className={`grid grid-cols-2 md:grid-cols-4 ${timesheetMetaGap} ${helperTextClass}`}>
                              <div>
                                <span className="text-muted-foreground">Total Hours:</span>
                                <span className="text-foreground ml-1">{ts.totalHours}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Entries:</span>
                                <span className="text-foreground ml-1">{ts.count}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Week Start:</span>
                                <span className="text-foreground ml-1">
                                  {formatDateByPreference(ts.weekStart, preferences.dateFormat, timezone)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Week End:</span>
                                <span className="text-foreground ml-1">
                                  {formatDateByPreference(ts.weekEnd, preferences.dateFormat, timezone)}
                                </span>
                              </div>
                            </div>

                            {canReview && ts.status === "pending" && (
                              <div className="mt-4 flex gap-2 flex-wrap">
                                <Button
                                  disabled={!tsId}
                                  onClick={() => tsId && reviewTimesheet(tsId, "approved")}
                                  className={buttonCompactClass}
                                >
                                  Approve
                                </Button>
                                <Button
                                  disabled={!tsId}
                                  variant="destructive"
                                  onClick={() => tsId && reviewTimesheet(tsId, "rejected")}
                                  className={buttonCompactClass}
                                >
                                  Reject
                                </Button>

                                {!tsId && (
                                  <div className="text-xs text-muted-foreground self-center">
                                    Backend must return timesheet id (_id or id) in GET /api/timesheets
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTimesheetDetails(ts.weekStart, ts.weekEnd)}
                            className={buttonCompactClass}
                          >
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
            <DialogContent className="max-w-3xl border-border bg-card text-card-foreground">
              <DialogHeader>
                <DialogTitle>Timesheet Details</DialogTitle>
                <DialogDescription>{detailsTitle}</DialogDescription>
              </DialogHeader>

              {detailsLoading ? (
                <div className={helperTextClass}>Loading...</div>
              ) : (
                <div className={detailsListSpacing}>
                  {detailsEntries.length === 0 ? (
                    <div className={helperTextClass}>No entries in this week.</div>
                  ) : (
                    detailsEntries.map((e) => {
                      const taskTitle =
                        typeof e.taskId === "string" ? "Task" : (e.taskId as any)?.title;
                      const projectName =
                        typeof e.projectId === "string" ? "Project" : (e.projectId as any)?.name;

                      return (
                        <div
                          key={e._id}
                          className={`${detailsRowPadding} border border-border rounded-lg bg-card`}
                        >
                          <div className={compactMode ? "text-sm text-foreground" : "text-foreground"}>
                            {taskTitle}
                          </div>
                          <div className={`${helperTextClass} mt-1 flex flex-wrap gap-3`}>
                            <span>{formatDateByPreference(e.date, preferences.dateFormat, timezone)}</span>
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