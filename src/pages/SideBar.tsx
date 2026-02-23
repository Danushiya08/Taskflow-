import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Clock,
  FileText,
  BarChart3,
  AlertTriangle,
  Settings,
  Calendar as CalendarIcon,
  Columns,
  DollarSign,
  ListChecks,
} from "lucide-react";

import { cn } from "@/components/ui/utils";

type Role = "admin" | "project-manager" | "team-member" | "client";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  currentUser: {
    role: Role;
  };
}

export function Sidebar({ currentPage, onNavigate, currentUser }: SidebarProps) {
  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "project-manager", "team-member", "client"] as Role[],
    },
    {
      id: "projects",
      label: "Projects",
      icon: FolderKanban,
      roles: ["admin", "project-manager", "team-member", "client"] as Role[],
    },
    {
      id: "team",
      label: "Team",
      icon: Users,
      roles: ["admin", "project-manager"] as Role[],
    },
    {
      id: "time-tracking",
      label: "Time Tracking",
      icon: Clock,
      roles: ["admin", "project-manager", "team-member"] as Role[],
    },
    {
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      roles: ["admin", "project-manager", "client"] as Role[],
    },
    {
      id: "documents",
      label: "Documents",
      icon: FileText,
      roles: ["admin", "project-manager", "team-member", "client"] as Role[],
    },
    {
      id: "risk-management",
      label: "Risk Management",
      icon: AlertTriangle,
      roles: ["admin", "project-manager"] as Role[],
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: CalendarIcon,
      roles: ["admin", "project-manager", "team-member"] as Role[],
    },
    {
      id: "kanban",
      label: "Kanban",
      icon: Columns,
      roles: ["admin", "project-manager", "team-member"] as Role[],
    },
    {
      id: "budget",
      label: "Budget",
      icon: DollarSign,
      roles: ["admin", "project-manager"] as Role[],
    },

    // ✅ UPDATED: client can now see Tasks in sidebar
    {
      id: "tasks",
      label: "Tasks",
      icon: ListChecks,
      roles: ["admin", "project-manager", "team-member", "client"] as Role[],
    },

    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      roles: ["admin", "project-manager", "team-member", "client"] as Role[],
    },
  ];

  // ✅ Only show items allowed for this role
  const visibleItems = menuItems.filter((item) => item.roles.includes(currentUser.role));

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl text-gray-900">TaskFlow</h1>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg">
          <h3 className="text-sm text-gray-900 mb-1">Need Help?</h3>
          <p className="text-xs text-gray-600 mb-3">Check our documentation and tutorials</p>
          <button className="text-xs text-blue-600 hover:underline">View Docs →</button>
        </div>
      </div>
    </div>
  );
}
