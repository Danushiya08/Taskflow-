import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import socket from "@/lib/socket";
import { toast } from "sonner";

import { LoginPage } from "./pages/LoginPage";
import { Header } from "./pages/Header";
import { Sidebar } from "./pages/SideBar";

import { Dashboard } from "./pages/Dashboard";
import { ProjectsPage } from "./pages/ProjectsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RiskManagementPage } from "./pages/RiskManagementPage";
import { TeamPage } from "./pages/TeamPage";
import { TimeTrackingPage } from "./pages/TimeTrackingPage";
import { CalendarPage } from "./pages/CalendarPage";
import { KanbanPage } from "./pages/KanbanPage";
import { BudgetPage } from "./pages/BudgetPage";
import { TasksPage } from "./pages/TasksPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ActivityPage } from "./pages/ActivityPage";

import { ClientDashboard } from "./components/dashboards/ClientDashboard";
import { ProjectManagerDashboard } from "./components/dashboards/ProjectManagerDashboard";
import { TeamMemberDashboard } from "./components/dashboards/TeamMemberDashboard";
import VideoCall from "./components/VideoCall";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Role = "admin" | "project-manager" | "team-member" | "client";

type Page =
  | "dashboard"
  | "projects"
  | "documents"
  | "reports"
  | "risk-management"
  | "team"
  | "time-tracking"
  | "calendar"
  | "kanban"
  | "budget"
  | "tasks"
  | "notifications"
  | "activity"
  | "settings";

type IncomingCallPayload = {
  from: string;
  signal: RTCSessionDescriptionInit;
};

const applyTheme = (theme: string) => {
  const root = window.document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
    localStorage.setItem("theme", "dark");
    return;
  }

  if (theme === "light") {
    root.classList.remove("dark");
    localStorage.setItem("theme", "light");
    return;
  }

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", systemDark);
  localStorage.setItem("theme", "auto");
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState<Page>(() => {
  return (localStorage.getItem("page") as Page) || "dashboard";
});
  const [loading, setLoading] = useState(true);

  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [incomingCaller, setIncomingCaller] = useState<any | null>(null);
  const [callModalOpen, setCallModalOpen] = useState(false);

  const role: Role | null = user?.role ?? null;

  const allowedPagesByRole: Record<Role, Page[]> = useMemo(
    () => ({
      admin: [
        "dashboard",
        "projects",
        "documents",
        "reports",
        "risk-management",
        "team",
        "time-tracking",
        "calendar",
        "kanban",
        "budget",
        "tasks",
        "notifications",
        "activity",
        "settings",
      ],
      "project-manager": [
        "dashboard",
        "projects",
        "documents",
        "reports",
        "risk-management",
        "team",
        "time-tracking",
        "calendar",
        "kanban",
        "budget",
        "tasks",
        "notifications",
        "activity",
        "settings",
      ],
      "team-member": [
        "dashboard",
        "projects",
        "documents",
        "team",
        "time-tracking",
        "calendar",
        "kanban",
        "tasks",
        "notifications",
        "activity",
        "settings",
      ],
      client: [
        "dashboard",
        "projects",
        "tasks",
        "documents",
        "reports",
        "calendar",
        "notifications",
        "activity",
        "settings",
      ],
    }),
    []
  );

  const isAllowed = (p: Page) => {
    if (!role) return false;
    return allowedPagesByRole[role].includes(p);
  };

  const handleNavigate = (p: string) => {
    const next = p as Page;
    if (!role) return;
    
     const finalPage = isAllowed(next) ? next : "dashboard";
  setPage(finalPage);
  localStorage.setItem("page", finalPage);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("page");
    socket.disconnect();
    setUser(null);
    setPage("dashboard");
    setIncomingCall(null);
    setIncomingCaller(null);
    setCallModalOpen(false);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }

    const loadMe = async () => {
      try {
        const res = await api.get("/me");
        const me = (res.data as any)?.user ?? res.data;

        if (!me || !me.role) {
          throw new Error("Invalid /api/me response");
        }

        setUser(me);
        localStorage.setItem("user", JSON.stringify(me));

        try {
          const settingsRes = await api.get("/settings/me");
          const savedTheme = settingsRes?.data?.preferences?.theme || "light";
          applyTheme(savedTheme);
        } catch {
          // ignore settings load failure here
        }
      } catch (e) {
        handleLogout();
      } finally {
        setLoading(false);
      }
    };

    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?._id) return;

    const registerUser = () => {
      socket.emit("register", user._id);
      console.log("✅ Socket registered for user:", user._id);
    };

    if (!socket.connected) {
      socket.connect();
    }

    socket.on("connect", registerUser);

    if (socket.connected) {
      registerUser();
    }

    return () => {
      socket.off("connect", registerUser);
    };
  }, [user]);

  useEffect(() => {
    if (!user?._id) return;

    const handleLiveNotification = (notification: any) => {
      console.log("🔔 Global live notification:", notification);
      toast.success(notification?.title || "New notification");
    };

    const handleLiveAlert = (alert: any) => {
      console.log("🚨 Global live alert:", alert);
      toast.success(alert?.title || "New alert received");
    };

    socket.on("new_notification", handleLiveNotification);
    socket.on("new_alert", handleLiveAlert);

    return () => {
      socket.off("new_notification", handleLiveNotification);
      socket.off("new_alert", handleLiveAlert);
    };
  }, [user]);

  useEffect(() => {
    if (!user?._id) return;

    const handleIncomingCall = async (payload: IncomingCallPayload) => {
      try {
        let caller: any = {
          _id: payload.from,
          name: payload.from,
        };

        try {
          const teamRes = await api.get("/team/users");
          const users = Array.isArray(teamRes.data?.users) ? teamRes.data.users : [];
          const matchedUser = users.find(
            (member: any) => String(member._id) === String(payload.from)
          );
          if (matchedUser) {
            caller = matchedUser;
          }
        } catch {
          // fallback to ID if team fetch fails
        }

        setIncomingCall(payload);
        setIncomingCaller(caller);
        toast.success(`Incoming call from ${caller?.name || payload.from}`);
      } catch (err) {
        console.error("Failed to handle incoming call:", err);
      }
    };

    socket.on("incoming-call", handleIncomingCall);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
    };
  }, [user]);

  useEffect(() => {
    if (user && role && !isAllowed(page)) {
      setPage("dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, page]);

  const acceptIncomingCall = () => {
    if (!incomingCall || !incomingCaller) return;
    setCallModalOpen(true);
  };

  const rejectIncomingCall = () => {
    if (incomingCall?.from) {
      socket.emit("end-call", {
        to: incomingCall.from,
        from: user?._id,
      });
    }

    setIncomingCall(null);
    setIncomingCaller(null);
    setCallModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <LoginPage
          onLogin={async (u) => {
            setUser(u);
            localStorage.setItem("user", JSON.stringify(u));

            try {
              const settingsRes = await api.get("/settings/me");
              const savedTheme = settingsRes?.data?.preferences?.theme || "light";
              applyTheme(savedTheme);
            } catch {
              applyTheme(localStorage.getItem("theme") || "light");
            }
          }}
        />
      ) : (
        <>
          <div className="flex h-screen bg-background text-foreground">
            <Sidebar currentPage={page} onNavigate={handleNavigate} currentUser={user} />

            <div className="flex flex-col flex-1 overflow-hidden">
              <Header currentUser={user} onLogout={handleLogout} />

              <main className="flex-1 overflow-y-auto bg-background text-foreground">
                {page === "dashboard" && role === "admin" && <Dashboard />}
                {page === "dashboard" && role === "project-manager" && <ProjectManagerDashboard />}
                {page === "dashboard" && role === "team-member" && <TeamMemberDashboard />}
                {page === "dashboard" && role === "client" && <ClientDashboard />}

                {page === "projects" && isAllowed("projects") && <ProjectsPage />}
                {page === "documents" && isAllowed("documents") && <DocumentsPage />}
                {page === "reports" && isAllowed("reports") && <ReportsPage />}
                {page === "risk-management" && isAllowed("risk-management") && <RiskManagementPage />}
                {page === "team" && isAllowed("team") && <TeamPage />}
                {page === "time-tracking" && isAllowed("time-tracking") && <TimeTrackingPage />}
                {page === "calendar" && isAllowed("calendar") && <CalendarPage />}
                {page === "kanban" && isAllowed("kanban") && <KanbanPage />}
                {page === "budget" && isAllowed("budget") && <BudgetPage />}
                {page === "tasks" && isAllowed("tasks") && <TasksPage />}
                {page === "notifications" && isAllowed("notifications") && <NotificationsPage />}
                {page === "activity" && isAllowed("activity") && <ActivityPage />}
                {page === "settings" && isAllowed("settings") && <SettingsPage />}
              </main>
            </div>
          </div>

          {incomingCall && incomingCaller && !callModalOpen && (
            <div className="fixed bottom-6 right-6 z-[100] w-[360px] rounded-2xl border bg-card text-card-foreground shadow-2xl p-4 space-y-4">
              <div>
                <div className="text-base font-semibold">Incoming video call</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {incomingCaller?.name || "Unknown user"} is calling you
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={rejectIncomingCall}>
                  Reject
                </Button>
                <Button onClick={acceptIncomingCall}>Accept</Button>
              </div>
            </div>
          )}

          <Dialog
            open={callModalOpen}
            onOpenChange={(open) => {
              setCallModalOpen(open);
              if (!open) {
                setIncomingCall(null);
                setIncomingCaller(null);
              }
            }}
          >
            <DialogContent className="max-w-5xl border-border bg-card text-card-foreground">
              <DialogHeader>
                <DialogTitle>Video Call</DialogTitle>
                <DialogDescription>
                  {incomingCaller?.name
                    ? `Connected with ${incomingCaller.name}`
                    : "Video call"}
                </DialogDescription>
              </DialogHeader>

              {user?._id && incomingCaller?._id && incomingCall ? (
                <VideoCall
                  currentUserId={user._id}
                  targetUserId={incomingCaller._id}
                  initialIncomingCall={incomingCall}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  Unable to start call. Missing user information.
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}