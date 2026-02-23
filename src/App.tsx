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
  | "settings";

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
        "settings",
      ],

      // ✅ FIXED: allow clients to access Reports page
      // CHANGED LINE: added "reports"
      client: ["dashboard", "projects", "tasks", "documents", "reports", "calendar", "settings"],
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

  // verify token on refresh using /api/me
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }

    const loadMe = async () => {
      try {
        const res = await api.get("/me"); // ✅ baseURL="/api" => /api/me

        const me = (res.data as any)?.user ?? res.data;
        if (!me || !me.role) throw new Error("Invalid /api/me response");

        setUser(me);
        localStorage.setItem("user", JSON.stringify(me));
      } catch (e) {
        handleLogout();
      } finally {
        setLoading(false);
      }
    };

    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep page valid after login/refresh
  useEffect(() => {
    if (user && role && !isAllowed(page)) setPage("dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-700 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <LoginPage
          onLogin={(u) => {
            setUser(u);
          }}
        />
      ) : (
        <div className="flex h-screen bg-gray-50">
          <Sidebar currentPage={page} onNavigate={handleNavigate} currentUser={user} />

          <div className="flex flex-col flex-1 overflow-hidden">
            <Header currentUser={user} onLogout={handleLogout} />

            <main className="flex-1 overflow-y-auto">
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
              {page === "settings" && isAllowed("settings") && <SettingsPage />}
            </main>
          </div>
        </div>
      )}
    </>
  );
}
