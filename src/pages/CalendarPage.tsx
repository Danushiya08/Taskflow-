import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { formatDateByPreference, formatTimeWithTimezone } from "@/lib/dateFormat";
import { mapTimezonePreference } from "@/lib/timezone";

type CalendarEvent = {
  _id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  type?: "meeting" | "deadline" | "review" | "planning" | "presentation";
  projectId?: string;
  projectName?: string;
  color?: string;
  source?: "task" | "project" | "custom";
};

type ProjectLite = {
  _id: string;
  name: string;
};

const TYPE_COLORS: Record<string, string> = {
  meeting: "#3B82F6",
  deadline: "#EF4444",
  review: "#A855F7",
  planning: "#22C55E",
  presentation: "#EAB308",
  event: "#64748B",
};

const getTypeColor = (type?: string) => TYPE_COLORS[type || ""] || TYPE_COLORS.event;

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const { preferences, loadingPreferences } = useUserPreferences();

  const timezone = useMemo(
    () => mapTimezonePreference(preferences.timezone),
    [preferences.timezone]
  );

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    type: "" as "" | "meeting" | "deadline" | "review" | "planning" | "presentation",
    projectId: "",
  });

  const resetForm = () =>
    setForm({
      title: "",
      description: "",
      date: "",
      time: "",
      type: "",
      projectId: "",
    });

  const loadEvents = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const res = await api.get<{ events: CalendarEvent[] }>(
        `/calendar/events?month=${year}-${month}`
      );
      setEvents(res.data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      setProjectsLoading(true);
      const res = await api.get<{ projects: ProjectLite[] }>(`/calendar/projects`);
      setProjects(res.data.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  useEffect(() => {
    if (isAddEventOpen) loadProjects();
    if (!isAddEventOpen) resetForm();
  }, [isAddEventOpen]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);

  const previousMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const goToday = () => setCurrentDate(new Date());

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;

    return events.filter((event) => event.date === dateStr);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const handleAddEvent = async () => {
    try {
      if (!form.title.trim()) return toast.error("Event title is required.");
      if (!form.date) return toast.error("Event date is required.");
      if (!form.type) return toast.error("Event type is required.");
      if (!form.projectId) return toast.error("Please select a project.");

      await api.post(`/calendar/events`, {
        title: form.title.trim(),
        description: form.description?.trim() || "",
        date: form.date,
        time: form.time || "",
        type: form.type,
        projectId: form.projectId,
      });

      toast.success("Event added successfully!");
      setIsAddEventOpen(false);
      await loadEvents();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add event.");
    }
  };

  const monthName = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);

    return [...events]
      .filter((e) => e.date >= todayYMD)
      .sort((a, b) => {
        const aDateTime = new Date(`${a.date}T${a.time || "00:00"}:00`).getTime();
        const bDateTime = new Date(`${b.date}T${b.time || "00:00"}:00`).getTime();
        return aDateTime - bDateTime;
      })
      .slice(0, 5);
  }, [events]);

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Calendar</h1>
          <p className="text-muted-foreground">
            View and manage project deadlines, meetings, and events
          </p>
        </div>

        <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>

          <DialogContent className="border-border bg-card text-card-foreground">
            <DialogHeader>
              <DialogTitle>Add New Event</DialogTitle>
              <DialogDescription>
                Schedule a meeting, deadline, or milestone
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="event-title">Event Title</Label>
                <Input
                  id="event-title"
                  placeholder="e.g., Sprint Planning"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  placeholder="Event details..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event-date">Date</Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-time">Time</Label>
                  <Input
                    id="event-time"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      type: v as "" | "meeting" | "deadline" | "review" | "planning" | "presentation",
                    }))
                  }
                >
                  <SelectTrigger id="event-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-project">Project</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) => setForm((p) => ({ ...p, projectId: v }))}
                >
                  <SelectTrigger id="event-project">
                    <SelectValue
                      placeholder={projectsLoading ? "Loading projects..." : "Select project"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No projects available
                      </SelectItem>
                    ) : (
                      projects.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddEventOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEvent}>Add Event</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border bg-card text-card-foreground">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>{monthName}</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToday}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading || loadingPreferences ? (
              <div className="text-sm text-muted-foreground">Loading events...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-sm text-muted-foreground p-2">
                    {day}
                  </div>
                ))}

                {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="aspect-square p-1" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const day = idx + 1;
                  const dayEvents = getEventsForDate(day);
                  const today = isToday(day);

                  return (
                    <div
                      key={day}
                      className={`aspect-square p-1 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors ${
                        today ? "bg-primary/10 border-primary/40" : ""
                      }`}
                    >
                      <div className="h-full flex flex-col">
                        <div
                          className={`text-sm text-center mb-1 ${
                            today ? "text-primary font-medium" : "text-card-foreground"
                          }`}
                        >
                          {day}
                        </div>

                        <div className="flex-1 space-y-1 overflow-hidden">
                          {dayEvents.slice(0, 2).map((event) => {
                            const bg = event.color || getTypeColor(event.type);

                            return (
                              <div
                                key={event._id}
                                className="text-white text-xs p-1 rounded truncate"
                                style={{ backgroundColor: bg }}
                                title={`${event.title}${event.projectName ? ` (${event.projectName})` : ""}`}
                              >
                                {event.title}
                              </div>
                            );
                          })}

                          {dayEvents.length > 2 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
          </CardHeader>

          <CardContent>
            {upcomingEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground">No upcoming events.</div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const col = event.color || getTypeColor(event.type);

                  return (
                    <div
                      key={event._id}
                      className="p-3 border border-border rounded-lg hover:border-primary/40 transition-colors cursor-pointer bg-card"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-1 rounded"
                          style={{ backgroundColor: col, minHeight: "100%" }}
                        />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-card-foreground mb-1">
                            {event.title}
                          </h4>

                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {formatDateByPreference(
                                event.date,
                                preferences.dateFormat,
                                timezone
                              )}
                            </div>

                            {event.time ? (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeWithTimezone(event.date, event.time, timezone)}
                              </div>
                            ) : null}

                            <Badge variant="outline" className="text-xs">
                              {event.type || "event"}
                            </Badge>

                            <div className="text-xs text-muted-foreground">
                              {event.projectName || "Project"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>Event Types</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: TYPE_COLORS.meeting }}
              />
              <span className="text-sm text-muted-foreground">Meeting</span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: TYPE_COLORS.deadline }}
              />
              <span className="text-sm text-muted-foreground">Deadline</span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: TYPE_COLORS.review }}
              />
              <span className="text-sm text-muted-foreground">Review</span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: TYPE_COLORS.planning }}
              />
              <span className="text-sm text-muted-foreground">Planning</span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: TYPE_COLORS.presentation }}
              />
              <span className="text-sm text-muted-foreground">Presentation</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}