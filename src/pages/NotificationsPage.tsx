import { useEffect, useMemo, useState } from "react";
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
  Bell,
  CheckCircle2,
  FolderKanban,
  Clock3,
  Activity,
  CheckCheck,
  FileText,
  AlertTriangle,
  Siren,
} from "lucide-react";
import { toast } from "sonner";

type NotificationType =
  | "task_assigned"
  | "task_status_changed"
  | "project_created"
  | "deadline_approaching"
  | "activity_added"
  | "document"
  | "document_uploaded"
  | "document_shared"
  | "document_deleted"
  | "document_restored";

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: NotificationType | string;
  isRead: boolean;
  createdAt: string;
  relatedProject?: {
    _id: string;
    name: string;
  } | null;
  relatedTask?: {
    _id: string;
    title: string;
    status?: string;
    dueDate?: string;
  } | null;
};

type NotificationResponse = {
  notifications?: NotificationItem[];
  unreadCount?: number;
};

type AlertType =
  | "task_overdue"
  | "task_due_soon"
  | "project_overdue"
  | "project_due_soon"
  | "budget_warning"
  | "document_pending_review";

type AlertSeverity = "low" | "medium" | "high";

type AlertItem = {
  _id: string;
  title: string;
  message: string;
  type: AlertType | string;
  severity: AlertSeverity;
  isRead: boolean;
  createdAt: string;
  project?: {
    _id: string;
    name: string;
    status?: string;
    dueDate?: string;
    progress?: number;
  } | null;
  task?: {
    _id: string;
    title: string;
    status?: string;
    dueDate?: string;
    priority?: string;
  } | null;
};

type CurrentUserResponse = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

const notificationFilterOptions: Array<"all" | NotificationType> = [
  "all",
  "task_assigned",
  "task_status_changed",
  "project_created",
  "deadline_approaching",
  "activity_added",
  "document",
  "document_uploaded",
  "document_shared",
  "document_deleted",
  "document_restored",
];

const alertFilterOptions: Array<"all" | AlertType> = [
  "all",
  "task_overdue",
  "task_due_soon",
  "project_overdue",
  "project_due_soon",
  "budget_warning",
  "document_pending_review",
];

const getNotificationTypeIcon = (type: NotificationType | string) => {
  switch (type) {
    case "task_assigned":
      return <CheckCircle2 className="h-4 w-4" />;
    case "task_status_changed":
      return <Activity className="h-4 w-4" />;
    case "project_created":
      return <FolderKanban className="h-4 w-4" />;
    case "deadline_approaching":
      return <Clock3 className="h-4 w-4" />;
    case "activity_added":
      return <Bell className="h-4 w-4" />;
    case "document":
    case "document_uploaded":
    case "document_shared":
    case "document_deleted":
    case "document_restored":
      return <FileText className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

const getNotificationTypeLabel = (type: NotificationType | string) => {
  switch (type) {
    case "task_assigned":
      return "Task Assigned";
    case "task_status_changed":
      return "Task Status";
    case "project_created":
      return "Project Created";
    case "deadline_approaching":
      return "Deadline";
    case "activity_added":
      return "Activity";
    case "document":
      return "Document";
    case "document_uploaded":
      return "Document Uploaded";
    case "document_shared":
      return "Document Shared";
    case "document_deleted":
      return "Document Deleted";
    case "document_restored":
      return "Document Restored";
    default:
      return "Notification";
  }
};

const getAlertTypeIcon = (type: AlertType | string) => {
  switch (type) {
    case "task_overdue":
    case "project_overdue":
      return <Siren className="h-4 w-4" />;
    case "task_due_soon":
    case "project_due_soon":
      return <Clock3 className="h-4 w-4" />;
    case "budget_warning":
    case "document_pending_review":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
};

const getAlertTypeLabel = (type: AlertType | string) => {
  switch (type) {
    case "task_overdue":
      return "Task Overdue";
    case "task_due_soon":
      return "Task Due Soon";
    case "project_overdue":
      return "Project Overdue";
    case "project_due_soon":
      return "Project Due Soon";
    case "budget_warning":
      return "Budget Warning";
    case "document_pending_review":
      return "Pending Review";
    default:
      return "Alert";
  }
};

const getSeverityBadgeClass = (severity: AlertSeverity | string) => {
  switch (severity) {
    case "high":
      return "border-red-200 bg-red-50 text-red-700";
    case "medium":
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    case "low":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "";
  }
};

const formatRelativeTime = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

export function NotificationsPage() {
  const [userRole, setUserRole] = useState("team-member");

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  const [notificationTypeFilter, setNotificationTypeFilter] = useState<
    "all" | NotificationType
  >("all");
  const [alertTypeFilter, setAlertTypeFilter] = useState<"all" | AlertType>("all");

  const loadCurrentUser = async () => {
    try {
      const res = await api.get<CurrentUserResponse>("/me");
      setUserRole(res.data?.role || "team-member");
    } catch (error) {
      console.error("Failed to load current user role", error);
      setUserRole("team-member");
    }
  };

  const loadNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const res = await api.get<NotificationResponse>("/notifications");

      const data = Array.isArray(res.data?.notifications)
        ? res.data.notifications
        : [];

      setNotifications(
        data.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
    } catch (error) {
      console.error("Failed to load notifications", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoadingNotifications(false);
    }
  };

  const loadAlerts = async (role: string) => {
    try {
      setLoadingAlerts(true);

      const res = await api.get<AlertItem[]>(`/alerts?role=${role}`);

      const data = Array.isArray(res.data) ? res.data : [];

      setAlerts(
        data.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
    } catch (error) {
      console.error("Failed to load alerts", error);
      toast.error("Failed to load alerts");
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
    loadNotifications();
  }, []);

  useEffect(() => {
    if (userRole) {
      loadAlerts(userRole);
    }
  }, [userRole]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const unreadAlertCount = useMemo(
    () => alerts.filter((a) => !a.isRead).length,
    [alerts]
  );

  const totalUnreadCount = unreadNotificationCount + unreadAlertCount;

  const filteredNotifications = useMemo(() => {
    if (notificationTypeFilter === "all") return notifications;

    if (notificationTypeFilter === "document") {
      return notifications.filter(
        (n) =>
          n.type === "document" ||
          n.type === "document_uploaded" ||
          n.type === "document_shared" ||
          n.type === "document_deleted" ||
          n.type === "document_restored"
      );
    }

    return notifications.filter((n) => n.type === notificationTypeFilter);
  }, [notifications, notificationTypeFilter]);

  const filteredAlerts = useMemo(() => {
    if (alertTypeFilter === "all") return alerts;
    return alerts.filter((a) => a.type === alertTypeFilter);
  }, [alerts, alertTypeFilter]);

  const unreadNotifications = filteredNotifications.filter((n) => !n.isRead);
  const readNotifications = filteredNotifications.filter((n) => n.isRead);

  const unreadAlerts = filteredAlerts.filter((a) => !a.isRead);
  const readAlerts = filteredAlerts.filter((a) => a.isRead);

  const markNotificationAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark notification as read", error);
      toast.error("Could not update notification");
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
      toast.error("Could not update notifications");
    }
  };

  const markAlertAsRead = async (id: string) => {
    try {
      await api.patch(`/alerts/${id}/read`);
      setAlerts((prev) =>
        prev.map((a) => (a._id === id ? { ...a, isRead: true } : a))
      );
    } catch (error) {
      console.error("Failed to mark alert as read", error);
      toast.error("Could not update alert");
    }
  };

  const markAllAlertsAsRead = async () => {
    try {
      await api.patch(`/alerts/read-all?role=${userRole}`);
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
      toast.success("All alerts marked as read");
    } catch (error) {
      console.error("Failed to mark all alerts as read", error);
      toast.error("Could not update alerts");
    }
  };

  const renderNotificationList = (
    items: NotificationItem[],
    isReadList: boolean
  ) => {
    if (loadingNotifications) {
      return (
        <div className="text-sm text-muted-foreground">
          Loading notifications...
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {isReadList ? "No read notifications" : "No unread notifications"}
        </div>
      );
    }

    return items.map((notification) => (
      <div
        key={notification._id}
        className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
          isReadList ? "opacity-80" : "bg-primary/5"
        }`}
      >
        <div className="flex gap-3">
          <div className="mt-1 text-muted-foreground">
            {getNotificationTypeIcon(notification.type)}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{notification.title}</p>
              <Badge variant="outline">
                {getNotificationTypeLabel(notification.type)}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              {notification.message}
            </p>

            {notification.relatedProject?.name && (
              <p className="text-xs text-muted-foreground">
                Project: {notification.relatedProject.name}
              </p>
            )}

            {notification.relatedTask?.title && (
              <p className="text-xs text-muted-foreground">
                Task: {notification.relatedTask.title}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </p>
          </div>
        </div>

        {!isReadList && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => markNotificationAsRead(notification._id)}
          >
            Mark as read
          </Button>
        )}
      </div>
    ));
  };

  const renderAlertList = (items: AlertItem[], isReadList: boolean) => {
    if (loadingAlerts) {
      return <div className="text-sm text-muted-foreground">Loading alerts...</div>;
    }

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {isReadList ? "No read alerts" : "No unread alerts"}
        </div>
      );
    }

    return items.map((alert) => (
      <div
        key={alert._id}
        className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
          isReadList ? "opacity-80" : "bg-red-50/40"
        }`}
      >
        <div className="flex gap-3">
          <div className="mt-1 text-muted-foreground">
            {getAlertTypeIcon(alert.type)}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{alert.title}</p>

              <Badge variant="outline">
                {getAlertTypeLabel(alert.type)}
              </Badge>

              <Badge
                variant="outline"
                className={getSeverityBadgeClass(alert.severity)}
              >
                {alert.severity}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">{alert.message}</p>

            {alert.project?.name && (
              <p className="text-xs text-muted-foreground">
                Project: {alert.project.name}
              </p>
            )}

            {alert.task?.title && (
              <p className="text-xs text-muted-foreground">
                Task: {alert.task.title}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(alert.createdAt)}
            </p>
          </div>
        </div>

        {!isReadList && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAlertAsRead(alert._id)}
          >
            Mark as read
          </Button>
        )}
      </div>
    ));
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Notifications & Alerts
          </h1>
          <p className="text-muted-foreground">
            Stay updated with assignments, activity, documents, deadlines, and smart warnings.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Role: {userRole}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={markAllNotificationsAsRead}
            className="gap-2"
            variant="outline"
            disabled={unreadNotificationCount === 0}
          >
            <CheckCheck className="h-4 w-4" />
            Read all notifications
          </Button>

          <Button
            onClick={markAllAlertsAsRead}
            className="gap-2"
            disabled={unreadAlertCount === 0}
          >
            <CheckCheck className="h-4 w-4" />
            Read all alerts
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Notifications</CardTitle>
            <CardDescription>All activity updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Alerts</CardTitle>
            <CardDescription>Smart warning signals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{alerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unread Notifications</CardTitle>
            <CardDescription>Pending activity updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{unreadNotificationCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unread Total</CardTitle>
            <CardDescription>Notifications + alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUnreadCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications">
            Notifications
            {unreadNotificationCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {unreadNotificationCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="alerts">
            Alerts
            {unreadAlertCount > 0 && (
              <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                {unreadAlertCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Filters</CardTitle>
              <CardDescription>Filter by notification type</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {notificationFilterOptions.map((type) => (
                <Button
                  key={type}
                  variant={notificationTypeFilter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNotificationTypeFilter(type)}
                  className="capitalize"
                >
                  {type === "all" ? "All" : getNotificationTypeLabel(type)}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Tabs defaultValue="unread" className="space-y-4">
            <TabsList>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="read">Read</TabsTrigger>
            </TabsList>

            <TabsContent value="unread">
              <Card>
                <CardHeader>
                  <CardTitle>Unread Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderNotificationList(unreadNotifications, false)}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="read">
              <Card>
                <CardHeader>
                  <CardTitle>Read Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderNotificationList(readNotifications, true)}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Filters</CardTitle>
              <CardDescription>Filter by smart alert type</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {alertFilterOptions.map((type) => (
                <Button
                  key={type}
                  variant={alertTypeFilter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAlertTypeFilter(type)}
                  className="capitalize"
                >
                  {type === "all" ? "All" : getAlertTypeLabel(type)}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Tabs defaultValue="unread" className="space-y-4">
            <TabsList>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="read">Read</TabsTrigger>
            </TabsList>

            <TabsContent value="unread">
              <Card>
                <CardHeader>
                  <CardTitle>Unread Alerts</CardTitle>
                  <CardDescription>
                    Overdue tasks, due soon warnings, and project deadline risks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderAlertList(unreadAlerts, false)}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="read">
              <Card>
                <CardHeader>
                  <CardTitle>Read Alerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderAlertList(readAlerts, true)}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}