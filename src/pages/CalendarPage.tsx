import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
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

type CalendarEvent = {
  _id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // "10:00"
  type?: "meeting" | "deadline" | "review" | "planning" | "presentation";
  projectId?: string;
  projectName?: string;
  color?: string; // backend can send; frontend fallback computes
  source?: "task" | "project" | "custom";
};

type ProjectLite = {
  _id: string;
  name: string;
};

const TYPE_COLORS: Record<string, string> = {
  meeting: "#3B82F6", // blue-500
  deadline: "#EF4444", // red-500
  review: "#A855F7", // purple-500
  planning: "#22C55E", // green-500
  presentation: "#EAB308", // yellow-500
  event: "#64748B", // slate-500 fallback
};

const getTypeColor = (type?: string) => TYPE_COLORS[type || ""] || TYPE_COLORS.event;

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // ----- form state -----
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
      const res = await api.get<{ events: CalendarEvent[] }>(`/calendar/events?month=${year}-${month}`);
      setEvents(res.data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch projects for the dropdown (uses a calendar endpoint we add below)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  useEffect(() => {
    if (isAddEventOpen) loadProjects();
    if (!isAddEventOpen) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((event) => event.date === dateStr);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
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
        date: form.date, // YYYY-MM-DD
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

  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const todayYMD = now.toISOString().slice(0, 10);
    return [...events]
      .filter((e) => e.date >= todayYMD)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [events]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Calendar</h1>
          <p className="text-gray-600">View and manage project deadlines, meetings, and events</p>
        </div>

        <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Event</DialogTitle>
              <DialogDescription>Schedule a meeting, deadline, or milestone</DialogDescription>
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
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as any }))}>
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
                <Select value={form.projectId} onValueChange={(v) => setForm((p) => ({ ...p, projectId: v }))}>
                  <SelectTrigger id="event-project">
                    <SelectValue placeholder={projectsLoading ? "Loading projects..." : "Select project"} />
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
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
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
            {loading ? (
              <div className="text-sm text-gray-600">Loading events...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-sm text-gray-600 p-2">
                    {day}
                  </div>
                ))}

                {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="aspect-square p-1"></div>
                ))}

                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const day = idx + 1;
                  const dayEvents = getEventsForDate(day);
                  const today = isToday(day);

                  return (
                    <div
                      key={day}
                      className={`aspect-square p-1 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
                        today ? "bg-blue-50 border-blue-300" : ""
                      }`}
                    >
                      <div className="h-full flex flex-col">
                        <div className={`text-sm text-center mb-1 ${today ? "text-blue-600" : "text-gray-900"}`}>
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
                            <div className="text-xs text-gray-600 text-center">+{dayEvents.length - 2} more</div>
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

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
          </CardHeader>

          <CardContent>
            {upcomingEvents.length === 0 ? (
              <div className="text-sm text-gray-500">No upcoming events.</div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const col = event.color || getTypeColor(event.type);
                  return (
                    <div
                      key={event._id}
                      className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-1 rounded" style={{ backgroundColor: col, minHeight: "100%" }}></div>
                        <div className="flex-1">
                          <h4 className="text-sm text-gray-900 mb-1">{event.title}</h4>
                          <div className="space-y-1 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {event.date} {event.time ? `at ${event.time}` : ""}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {event.type || "event"}
                            </Badge>
                            <div className="text-xs text-gray-500">{event.projectName || "Project"}</div>
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

      {/* Event Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Event Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: TYPE_COLORS.meeting }}></div>
              <span className="text-sm text-gray-600">Meeting</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: TYPE_COLORS.deadline }}></div>
              <span className="text-sm text-gray-600">Deadline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: TYPE_COLORS.review }}></div>
              <span className="text-sm text-gray-600">Review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: TYPE_COLORS.planning }}></div>
              <span className="text-sm text-gray-600">Planning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: TYPE_COLORS.presentation }}></div>
              <span className="text-sm text-gray-600">Presentation</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}