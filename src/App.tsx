import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

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

import { ClientDashboard } from "./components/dashboards/ClientDashboard";
import { ProjectManagerDashboard } from "./components/dashboards/ProjectManagerDashboard";
import { TeamMemberDashboard } from "./components/dashboards/TeamMemberDashboard";

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
  | "settings";

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
  const [page, setPage] = useState<Page>("dashboard");
  const [loading, setLoading] = useState(true);

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
        "settings",
      ],
      "team-member": [
        "dashboard",
        "projects",
        "documents",
        "time-tracking",
        "calendar",
        "kanban",
        "tasks",
        "notifications",
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
    setPage(isAllowed(next) ? next : "dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setPage("dashboard");
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
    if (user && role && !isAllowed(page)) {
      setPage("dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, page]);

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
              {page === "settings" && isAllowed("settings") && <SettingsPage />}
            </main>
          </div>
        </div>
      )}
    </>
  );
}