import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock } from "lucide-react";


export function SmartAlertsCard({
  tasks,
  projects,
}: {
  tasks: any[];
  projects: any[];
}) {
  const now = new Date();

  const isOverdue = (date?: string) => {
    if (!date) return false;
    return new Date(date) < now;
  };

  const isDueSoon = (date?: string) => {
    if (!date) return false;
    const due = new Date(date);
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3; // within 3 days
  };

  // 🔥 TASK ALERTS
  const overdueTasks = tasks.filter(
    (t) => t.status !== "completed" && isOverdue(t.dueDate)
  );

  const dueSoonTasks = tasks.filter(
    (t) => t.status !== "completed" && isDueSoon(t.dueDate)
  );

  // 🔥 PROJECT ALERTS
  const overdueProjects = projects.filter(
    (p) => p.progress < 100 && isOverdue(p.dueDate)
  );

  const dueSoonProjects = projects.filter(
    (p) => p.progress < 100 && isDueSoon(p.dueDate)
  );

  const hasAlerts =
    overdueTasks.length ||
    dueSoonTasks.length ||
    overdueProjects.length ||
    dueSoonProjects.length;

  if (!hasAlerts) return null;

  return (
    <Card className="border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle>Smart Alerts</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 🔴 Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <span>{overdueTasks.length} overdue tasks</span>
          </div>
        )}

        {/* 🟡 Due Soon Tasks */}
        {dueSoonTasks.length > 0 && (
          <div className="flex items-center gap-2 text-yellow-600">
            <Clock className="w-4 h-4" />
            <span>{dueSoonTasks.length} tasks due soon</span>
          </div>
        )}

        {/* 🔴 Overdue Projects */}
        {overdueProjects.length > 0 && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <span>{overdueProjects.length} overdue projects</span>
          </div>
        )}

        {/* 🟡 Due Soon Projects */}
        {dueSoonProjects.length > 0 && (
          <div className="flex items-center gap-2 text-yellow-600">
            <Clock className="w-4 h-4" />
            <span>{dueSoonProjects.length} projects due soon</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}