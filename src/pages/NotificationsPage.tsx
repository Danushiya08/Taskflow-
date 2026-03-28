import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

const filterOptions: Array<"all" | NotificationType> = [
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

const getTypeIcon = (type: NotificationType | string) => {
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

const getTypeLabel = (type: NotificationType | string) => {
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | NotificationType>("all");

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get<NotificationResponse>("/notifications");

      const data = Array.isArray(res.data?.notifications) ? res.data.notifications : [];

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
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (typeFilter === "all") return notifications;

    if (typeFilter === "document") {
      return notifications.filter(
        (n) =>
          n.type === "document" ||
          n.type === "document_uploaded" ||
          n.type === "document_shared" ||
          n.type === "document_deleted" ||
          n.type === "document_restored"
      );
    }

    return notifications.filter((n) => n.type === typeFilter);
  }, [notifications, typeFilter]);

  const unreadNotifications = filteredNotifications.filter((n) => !n.isRead);
  const readNotifications = filteredNotifications.filter((n) => n.isRead);

  const markAsRead = async (id: string) => {
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

  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all as read", error);
      toast.error("Could not update notifications");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with assignments, project activity, and deadlines.
          </p>
        </div>

        <Button onClick={markAllAsRead} className="gap-2" disabled={unreadCount === 0}>
          <CheckCheck className="h-4 w-4" />
          Mark all as read
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
            <CardTitle>Unread</CardTitle>
            <CardDescription>Pending attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{unreadCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
            <CardDescription>Notification type</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {filterOptions.map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(type)}
                className="capitalize"
              >
                {type === "all" ? "All" : getTypeLabel(type)}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

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
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading notifications...</div>
              ) : unreadNotifications.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  No unread notifications
                </div>
              ) : (
                unreadNotifications.map((notification) => (
                  <div
                    key={notification._id}
                    className="flex items-start justify-between gap-4 rounded-xl border p-4 bg-primary/5"
                  >
                    <div className="flex gap-3">
                      <div className="mt-1 text-muted-foreground">
                        {getTypeIcon(notification.type)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{notification.title}</p>
                          <Badge variant="outline">
                            {getTypeLabel(notification.type)}
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

                    <Button size="sm" variant="outline" onClick={() => markAsRead(notification._id)}>
                      Mark as read
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="read">
          <Card>
            <CardHeader>
              <CardTitle>Read Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading notifications...</div>
              ) : readNotifications.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  No read notifications
                </div>
              ) : (
                readNotifications.map((notification) => (
                  <div
                    key={notification._id}
                    className="flex items-start justify-between gap-4 rounded-xl border p-4 opacity-80"
                  >
                    <div className="flex gap-3">
                      <div className="mt-1 text-muted-foreground">
                        {getTypeIcon(notification.type)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{notification.title}</p>
                          <Badge variant="outline">
                            {getTypeLabel(notification.type)}
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
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}