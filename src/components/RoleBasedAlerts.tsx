import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import api from "@/lib/api";

type Alert = {
  _id: string;
  type: "task_overdue" | "task_due_soon" | "project_overdue" | "project_due_soon";
  message: string;
  createdAt: string;
};

export function RoleBasedAlerts({ role }: { role: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/alerts");
        setAlerts(res.data?.alerts || []);
      } catch (err) {
        console.error("Failed to load alerts");
      }
    };

    load();
  }, []);

  // 🔥 ROLE-BASED FILTER
  const filteredAlerts = alerts.filter((alert) => {
    if (role === "client") {
      return alert.type.includes("project"); // ❌ no task alerts
    }

    if (role === "team-member") {
      return alert.type.includes("task"); // only tasks
    }

    if (role === "project-manager") {
      return true; // both
    }

    if (role === "admin") {
      return true; // everything
    }

    return false;
  });

  if (filteredAlerts.length === 0) return null;

  return (
    <Card className="border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {filteredAlerts.slice(0, 5).map((alert) => (
          <div
            key={alert._id}
            className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg"
          >
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-1" />

            <div className="flex-1">
              <p className="text-sm text-card-foreground">{alert.message}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(alert.createdAt).toLocaleString()}
              </p>
            </div>

            <Badge variant="secondary">
              {alert.type.replace("_", " ")}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}