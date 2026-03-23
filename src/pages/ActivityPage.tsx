import { useEffect, useState } from "react";
import api from "@/lib/api";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import {
  Activity as ActivityIcon,
  FolderKanban,
  ListChecks,
  AlertTriangle,
  FileText,
  DollarSign,
  Users,
} from "lucide-react";

import { toast } from "sonner";

type ActivityItem = {
  _id: string;
  action: string;
  entityType:
    | "project"
    | "task"
    | "risk"
    | "document"
    | "budget"
    | "team"
    | "system";
  description: string;
  createdAt: string;

  user?: {
    _id: string;
    name: string;
    role?: string;
  } | null;

  project?: {
    _id: string;
    name: string;
  } | null;

  task?: {
    _id: string;
    title: string;
  } | null;
};

const formatRelativeTime = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);

  const diff = now.getTime() - date.getTime();

  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const getIcon = (type: string) => {
  switch (type) {
    case "project":
      return <FolderKanban className="w-4 h-4" />;

    case "task":
      return <ListChecks className="w-4 h-4" />;

    case "risk":
      return <AlertTriangle className="w-4 h-4" />;

    case "document":
      return <FileText className="w-4 h-4" />;

    case "budget":
      return <DollarSign className="w-4 h-4" />;

    case "team":
      return <Users className="w-4 h-4" />;

    default:
      return <ActivityIcon className="w-4 h-4" />;
  }
};

export function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = async () => {
    try {
      setLoading(true);

      const res = await api.get("/activity");

      const data = res?.data?.activities;

      setActivities(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Activity load error", error);
      toast.error("Failed to load activity log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  return (
    <div className="p-6 space-y-6">

      {/* Header */}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Activity Log
        </h1>

        <p className="text-muted-foreground">
          Track project, task, and system actions
        </p>
      </div>

      {/* Card */}

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>

          <CardDescription>
            Role-based activity history
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">

          {loading && (
            <div className="text-sm text-muted-foreground">
              Loading activity...
            </div>
          )}

          {!loading && activities.length === 0 && (
            <div className="border rounded-lg p-6 text-center text-muted-foreground">
              No activity found
            </div>
          )}

          {!loading &&
            activities.map((item) => (
              <div
                key={item._id}
                className="flex items-start gap-3 border rounded-lg p-4"
              >

                {/* icon */}

                <div className="mt-1 text-muted-foreground">
                  {getIcon(item.entityType)}
                </div>

                {/* content */}

                <div className="flex-1 space-y-1">

                  <div className="flex items-center gap-2 flex-wrap">

                    <span className="font-medium">
                      {item.description}
                    </span>

                    <Badge variant="outline" className="capitalize">
                      {item.entityType}
                    </Badge>

                  </div>

                  <div className="text-sm text-muted-foreground">

                    By {item.user?.name || "Unknown"}

                  </div>

                  {item.project?.name && (
                    <div className="text-xs text-muted-foreground">
                      Project: {item.project.name}
                    </div>
                  )}

                  {item.task?.title && (
                    <div className="text-xs text-muted-foreground">
                      Task: {item.task.title}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </div>

                </div>
              </div>
            ))}

        </CardContent>
      </Card>

    </div>
  );
}