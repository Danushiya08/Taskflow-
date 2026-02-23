// frontend/pages/TeamPage.tsx
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

import {
  Plus,
  Search,
  Mail,
  MoreVertical,
  CheckCircle2,
  TrendingUp,
  Clock,
  AlertTriangle,
  Trash2,
  User,
  Calendar,
  Flag,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader as DialogHeaderUI,
  DialogTitle as DialogTitleUI,
  DialogFooter,
} from "@/components/ui/dialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Role = "admin" | "project-manager" | "team-member" | "client";
type StatusFilter = "all" | "active" | "disabled";
type RoleFilter = "all" | Exclude<Role, "client">;
type SortBy = "recent" | "name" | "role" | "tasks";

type TaskStatus = "todo" | "in-progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "critical";

const NONE = "__none__";

const normalizeRole = (role: any): Role | string => {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "admin";
  if (["project-manager", "projectmanager", "project manager", "pm"].includes(r)) return "project-manager";
  if (["team-member", "teammember", "team member", "member"].includes(r)) return "team-member";
  if (r === "client") return "client";
  return r;
};

const roleLabel = (r: string) => {
  switch (r) {
    case "admin":
      return "Admin";
    case "project-manager":
      return "Project Manager";
    case "team-member":
      return "Team Member";
    case "client":
      return "Client";
    default:
      return r;
  }
};

const roleBadgeClass = (r: string) => {
  switch (r) {
    case "admin":
      return "bg-black text-white border-black";
    case "project-manager":
      return "bg-blue-600 text-white border-blue-600";
    case "team-member":
      return "bg-green-600 text-white border-green-600";
    case "client":
      return "bg-orange-500 text-white border-orange-500";
    default:
      return "bg-gray-200 text-gray-900 border-gray-200";
  }
};

const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || "User")}`;

const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case "critical":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
};

// ✅ NEW: workload risk helpers
const loadPercentFromTasks = (tasksCount: number) => {
  // You can tune this baseline (40 tasks = 100%)
  const pct = Math.round((tasksCount / 40) * 100);
  return Math.max(0, Math.min(100, pct));
};

const loadRiskFromTasks = (tasksCount: number) => {
  if (tasksCount >= 31) return { label: "Overloaded", variant: "destructive" as const };
  if (tasksCount >= 16) return { label: "High", variant: "default" as const };
  if (tasksCount >= 6) return { label: "Normal", variant: "secondary" as const };
  return { label: "Light", variant: "outline" as const };
};

export function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters + sorting
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  // pagination
  const [visibleCount, setVisibleCount] = useState(9);

  // menu
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  // Admin role edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState<Exclude<Role, "client">>("team-member");
  const [saving, setSaving] = useState(false);

  // Confirm disable/enable
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmUser, setConfirmUser] = useState<any | null>(null);

  // Confirm delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<any | null>(null);

  // Add member dialog (Admin + PM)
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<Exclude<Role, "client">>("team-member");
  const [adding, setAdding] = useState(false);

  // View + Details dialogs
  const [viewOpen, setViewOpen] = useState(false);
  const [viewUser, setViewUser] = useState<any | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsUser, setDetailsUser] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // details payload
  const [detailsPayload, setDetailsPayload] = useState<{
    user?: any;
    projects?: any[];
    tasks?: any[];
  }>({});

  // Assign Task dialog (Admin/PM only)
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<any | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [assignProjectId, setAssignProjectId] = useState<string>(NONE);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDescription, setAssignDescription] = useState("");
  const [assignStatus, setAssignStatus] = useState<TaskStatus>("todo");
  const [assignPriority, setAssignPriority] = useState<TaskPriority>("medium");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const myRole = normalizeRole(currentUser?.role) as Role;

  // Team CAN view page. Client cannot.
  const canViewTeam = myRole === "admin" || myRole === "project-manager" || myRole === "team-member";
  const canViewStats = myRole === "admin" || myRole === "project-manager";
  const canChangeRole = myRole === "admin";
  const canToggleUser = myRole === "admin" || myRole === "project-manager";
  const canAddMember = myRole === "admin" || myRole === "project-manager";
  const canDelete = myRole === "admin" || myRole === "project-manager";
  const canAssignTask = myRole === "admin" || myRole === "project-manager";

  const loadTeam = async () => {
    setLoading(true);
    try {
      const res = await api.get("/team/users");
      const list = Array.isArray(res.data?.users) ? res.data.users : [];
      setUsers(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load team");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await api.get("/projects");
      const list = Array.isArray(res.data?.projects) ? res.data.projects : [];
      setProjects(list.filter((p: any) => p && p._id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load projects");
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewTeam) {
      setLoading(false);
      return;
    }
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // stats (admin/pm only)
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => (typeof u.isActive === "boolean" ? u.isActive : true)).length;

    const taskCounts = users.map((u) => (typeof u.tasksCount === "number" ? u.tasksCount : 0));
    const avgTasks = total ? Math.round(taskCounts.reduce((a, b) => a + b, 0) / total) : 0;
    const avgLoad = loadPercentFromTasks(avgTasks);
    const overloaded = users.filter((u) => (typeof u.tasksCount === "number" ? u.tasksCount : 0) > 30).length;

    return { total, active, avgLoad, overloaded };
  }, [users]);

  const filteredSortedUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list = users
      .filter((u) => normalizeRole(u.role) !== "client")
      .filter((u) => {
        const name = String(u?.name || "").toLowerCase();
        const email = String(u?.email || "").toLowerCase();
        const role = String(u?.role || "").toLowerCase();

        const matchesSearch = !q || name.includes(q) || email.includes(q) || role.includes(q);

        const r = String(normalizeRole(u.role));
        const matchesRole = roleFilter === "all" || r === roleFilter;

        const active = typeof u.isActive === "boolean" ? u.isActive : true;
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && active) ||
          (statusFilter === "disabled" && !active);

        return matchesSearch && matchesRole && matchesStatus;
      });

    list = [...list].sort((a, b) => {
      if (sortBy === "recent") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortBy === "role") return String(a.role || "").localeCompare(String(b.role || ""));
      if (sortBy === "tasks") return Number(b.tasksCount || 0) - Number(a.tasksCount || 0);
      return 0;
    });

    return list;
  }, [users, searchQuery, roleFilter, statusFilter, sortBy]);

  const pagedUsers = useMemo(() => filteredSortedUsers.slice(0, visibleCount), [filteredSortedUsers, visibleCount]);

  const openEdit = (u: any) => {
    setEditingUser(u);
    setEditRole(normalizeRole(u.role) as any);
    setIsEditOpen(true);
  };

  const saveRole = async () => {
    if (!editingUser?._id) return;
    setSaving(true);
    try {
      const res = await api.patch(`/team/users/${editingUser._id}/role`, { role: editRole });
      toast.success(res.data?.message || "Role updated");
      setIsEditOpen(false);
      setEditingUser(null);
      await loadTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const askToggleUser = (u: any) => {
    setConfirmUser(u);
    setConfirmOpen(true);
  };

  const toggleUser = async () => {
    if (!confirmUser?._id) return;
    try {
      const res = await api.patch(`/team/users/${confirmUser._id}/toggle`);
      toast.success(res.data?.message || "Status updated");
      setConfirmOpen(false);
      setConfirmUser(null);
      await loadTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update status");
    }
  };

  const askDeleteUser = (u: any) => {
    setDeleteUser(u);
    setDeleteOpen(true);
  };

  const doDeleteUser = async () => {
    if (!deleteUser?._id) return;
    try {
      const res = await api.delete(`/team/users/${deleteUser._id}`);
      toast.success(res.data?.message || "User deleted");
      setDeleteOpen(false);
      setDeleteUser(null);
      await loadTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete user");
    }
  };

  const resetAdd = () => {
    setAddName("");
    setAddEmail("");
    setAddPassword("");
    setAddRole("team-member");
  };

  const addMember = async () => {
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      toast.error("Name, email and password are required");
      return;
    }

    setAdding(true);
    try {
      const payload: any = {
        name: addName.trim(),
        email: addEmail.trim(),
        password: addPassword.trim(),
      };

      if (myRole === "admin") payload.role = addRole;

      const res = await api.post("/team/users", payload);
      toast.success(res.data?.message || "Member added");
      setAddOpen(false);
      resetAdd();
      await loadTeam();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  // View
  const openView = (u: any) => {
    setViewUser(u);
    setViewOpen(true);
  };

  // Details (Admin/PM loads workload data)
  const openDetails = async (u: any) => {
    setDetailsUser(u);
    setDetailsPayload({});
    setDetailsOpen(true);

    if (!canViewStats) return;

    setDetailsLoading(true);
    try {
      const res = await api.get(`/team/users/${u._id}/details`);
      setDetailsPayload({
        user: res.data?.user,
        projects: Array.isArray(res.data?.projects) ? res.data.projects : [],
        tasks: Array.isArray(res.data?.tasks) ? res.data.tasks : [],
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load user details");
    } finally {
      setDetailsLoading(false);
    }
  };

  // Assign task
  const resetAssignForm = () => {
    setAssignProjectId(NONE);
    setAssignTitle("");
    setAssignDescription("");
    setAssignStatus("todo");
    setAssignPriority("medium");
    setAssignDueDate("");
  };

  const openAssign = async (u: any) => {
    if (!canAssignTask) {
      toast.error("Only Admin / Project Manager can assign tasks");
      return;
    }
    setAssignUser(u);
    resetAssignForm();
    setAssignOpen(true);

    if (projects.length === 0) {
      await loadProjects();
    }
  };

  const submitAssign = async () => {
    if (!assignUser?._id) return;

    if (!assignTitle.trim()) {
      toast.error("Task title is required");
      return;
    }

    if (!assignProjectId || assignProjectId === NONE) {
      toast.error("Please select a project");
      return;
    }

    setAssigning(true);
    try {
      const payload = {
        title: assignTitle.trim(),
        description: assignDescription.trim(),
        status: assignStatus,
        priority: assignPriority,
        dueDate: assignDueDate ? assignDueDate : null,
        assignedTo: assignUser._id,
      };

      const res = await api.post(`/projects/${assignProjectId}/tasks`, payload);

      toast.success(res.data?.message || "Task assigned");
      setAssignOpen(false);

      await loadTeam();
      if (detailsOpen && detailsUser?._id === assignUser._id && canViewStats) {
        await openDetails(assignUser);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to assign task");
    } finally {
      setAssigning(false);
    }
  };

  if (!canViewTeam) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-3xl text-gray-900">Team & Roles</h1>
        <p className="text-gray-600">This page is not available for your role.</p>
      </div>
    );
  }

  const overloadedDanger = stats.overloaded > 0;

  // ✅ NEW: computed details summaries
  const detailsTasks = Array.isArray(detailsPayload.tasks) ? detailsPayload.tasks : [];
  const detailsProjects = Array.isArray(detailsPayload.projects) ? detailsPayload.projects : [];

  const detailsCounts = useMemo(() => {
    const byStatus = { todo: 0, "in-progress": 0, done: 0 } as Record<TaskStatus, number>;
    for (const t of detailsTasks) {
      const s = (t?.status || "todo") as TaskStatus;
      if (byStatus[s] !== undefined) byStatus[s] += 1;
    }
    const total = detailsTasks.length;
    const loadPct = loadPercentFromTasks(total);
    const risk = loadRiskFromTasks(total);
    return { byStatus, total, loadPct, risk };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsOpen, detailsTasks.length]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Team & Roles</h1>
          <p className="text-gray-600">Manage users, roles, and workload across projects</p>
        </div>

        {canAddMember && (
          <Button
            type="button"
            onClick={() => {
              resetAdd();
              setAddOpen(true);
            }}
            title="Add a new internal user"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        )}
      </div>

      {/* Stats cards (Admin/PM only) */}
      {canViewStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Members</p>
                  <p className="text-2xl text-gray-900 mt-1">{stats.total}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Now</p>
                  <p className="text-2xl text-gray-900 mt-1">{stats.active}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg. Load</p>
                  <p className="text-2xl text-gray-900 mt-1">{stats.avgLoad}%</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className={overloadedDanger ? "border border-red-200" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Overloaded</p>
                  <p className={`text-2xl mt-1 ${overloadedDanger ? "text-red-600" : "text-gray-900"}`}>
                    {stats.overloaded}
                  </p>
                </div>
                <AlertTriangle className={`w-8 h-8 ${overloadedDanger ? "text-red-600" : "text-gray-400"}`} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Filters + Sort */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search team members..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="project-manager">Project Manager</SelectItem>
            <SelectItem value="team-member">Team Member</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently added</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="role">Role</SelectItem>
            <SelectItem value="tasks">Task count</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-sm text-gray-500">Loading team...</div>
      ) : pagedUsers.length === 0 ? (
        <div className="text-sm text-gray-500">
          No members found.
          <div className="text-xs text-gray-400 mt-1">Try changing filters or search keywords.</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pagedUsers.map((u) => {
              const r = String(normalizeRole(u.role));
              const active = typeof u.isActive === "boolean" ? u.isActive : true;
              const disabledStyle = !active ? "opacity-60 grayscale" : "";

              const pmCannotDisableAdmin = myRole === "project-manager" && (r === "admin" || r === "project-manager");
              const pmCannotDelete = myRole === "project-manager" && r !== "team-member";
              const adminCannotDeleteAdmin = myRole === "admin" && r === "admin";

              const projectsCount = canViewStats ? (typeof u.projectsCount === "number" ? u.projectsCount : 0) : null;
              const tasksCount = canViewStats ? (typeof u.tasksCount === "number" ? u.tasksCount : 0) : null;

              const topAssignedBy = canViewStats ? u.topAssignedBy : null;

              return (
                <Card key={u._id} className={`hover:shadow-lg transition-shadow ${disabledStyle}`}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <img
                        src={avatarUrl(u.name || u.email || "User")}
                        alt={u.name || "User"}
                        className="w-14 h-14 rounded-full"
                      />

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-lg text-gray-900 leading-tight">{u.name || "—"}</h3>

                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-xs px-2 py-1 rounded-md border ${roleBadgeClass(r)}`}>
                                {roleLabel(r)}
                              </span>

                              <Badge variant={active ? "secondary" : "destructive"}>
                                {active ? "Active" : "Disabled"}
                              </Badge>
                            </div>

                            <div className="text-xs text-gray-500 mt-2">{u.lastActiveLabel || "Offline"}</div>
                          </div>

                          {/* menu */}
                          <div className="relative">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={!active}
                              onClick={() => setOpenMenuFor((prev) => (prev === u._id ? null : u._id))}
                              title="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>

                            {openMenuFor === u._id && (
                              <div
                                className="absolute right-0 mt-2 w-52 bg-white border rounded-md shadow-md z-10"
                                onMouseLeave={() => setOpenMenuFor(null)}
                              >
                                {canChangeRole ? (
                                  <button
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                    onClick={() => {
                                      setOpenMenuFor(null);
                                      openEdit(u);
                                    }}
                                  >
                                    Edit role
                                  </button>
                                ) : (
                                  <div className="px-3 py-2 text-sm text-gray-400">No role changes</div>
                                )}

                                {canToggleUser ? (
                                  <button
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                                    disabled={pmCannotDisableAdmin}
                                    title={pmCannotDisableAdmin ? "PM cannot disable Admin/PM" : ""}
                                    onClick={() => {
                                      setOpenMenuFor(null);
                                      askToggleUser(u);
                                    }}
                                  >
                                    {active ? "Disable user" : "Enable user"}
                                  </button>
                                ) : null}

                                {canDelete ? (
                                  <button
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                                    disabled={adminCannotDeleteAdmin || pmCannotDelete}
                                    title={
                                      adminCannotDeleteAdmin
                                        ? "Admin user cannot be deleted"
                                        : pmCannotDelete
                                        ? "PM can delete only Team Members"
                                        : ""
                                    }
                                    onClick={() => {
                                      setOpenMenuFor(null);
                                      askDeleteUser(u);
                                    }}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Trash2 className="w-4 h-4" />
                                      Delete user
                                    </span>
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* quick actions */}
                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm" disabled={!active} onClick={() => openView(u)}>
                            View
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!active || !canAssignTask}
                            title={!canAssignTask ? "Only Admin/PM can assign tasks" : "Assign a task"}
                            onClick={() => openAssign(u)}
                          >
                            Assign
                          </Button>

                          <Button variant="outline" size="sm" disabled={!active} onClick={() => openDetails(u)}>
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{u.email || "—"}</span>
                    </div>

                    {/* Admin/PM only sections */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                      <div className="rounded-md border p-3" title="Tasks assigned to this user">
                        <p className="text-xs text-gray-500">📌 Tasks</p>
                        <p className="text-lg text-gray-900">{tasksCount === null ? "—" : tasksCount}</p>

                        {Array.isArray(u.tasks) && u.tasks.length > 0 && canViewStats ? (
                          <ul className="text-xs text-gray-600 mt-2 space-y-1">
                            {u.tasks.map((t: any) => (
                              <li key={t._id} className="truncate" title={t.title}>
                                • {t.title}
                              </li>
                            ))}
                          </ul>
                        ) : tasksCount === 0 && tasksCount !== null ? (
                          <p className="text-xs text-gray-400 mt-1">No tasks assigned yet</p>
                        ) : null}

                        {topAssignedBy && topAssignedBy?.name ? (
                          <p className="text-xs text-gray-500 mt-2">
                            Mostly assigned by: <span className="text-gray-700">{topAssignedBy.name}</span> (
                            {topAssignedBy.count})
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-md border p-3" title="Projects this user is part of">
                        <p className="text-xs text-gray-500">📁 Projects</p>
                        <p className="text-lg text-gray-900">{projectsCount === null ? "—" : projectsCount}</p>

                        {Array.isArray(u.projects) && u.projects.length > 0 && canViewStats ? (
                          <ul className="text-xs text-gray-600 mt-2 space-y-1">
                            {u.projects.map((p: any) => (
                              <li key={p._id} className="truncate" title={p.name}>
                                • {p.name}
                              </li>
                            ))}
                          </ul>
                        ) : projectsCount === 0 && projectsCount !== null ? (
                          <p className="text-xs text-gray-400 mt-1">No projects yet</p>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Load more */}
          {visibleCount < filteredSortedUsers.length && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => setVisibleCount((c) => c + 9)}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      {/* View dialog */}
      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) setViewUser(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeaderUI>
            <DialogTitleUI>User Profile</DialogTitleUI>
            <DialogDescription>Basic information</DialogDescription>
          </DialogHeaderUI>

          <div className="flex items-start gap-4">
            <img
              src={avatarUrl(viewUser?.name || viewUser?.email || "User")}
              alt={viewUser?.name || "User"}
              className="w-16 h-16 rounded-full"
            />
            <div className="flex-1">
              <div className="text-lg text-gray-900 font-medium">{viewUser?.name || "—"}</div>
              <div className="text-sm text-gray-600">{viewUser?.email || "—"}</div>

              <div className="flex items-center gap-2 mt-3">
                <span
                  className={`text-xs px-2 py-1 rounded-md border ${roleBadgeClass(String(normalizeRole(viewUser?.role)))}`}
                >
                  {roleLabel(String(normalizeRole(viewUser?.role)))}
                </span>
                <Badge variant={viewUser?.isActive ? "secondary" : "destructive"}>
                  {viewUser?.isActive ? "Active" : "Disabled"}
                </Badge>
              </div>

              <div className="text-xs text-gray-500 mt-2">{viewUser?.lastActiveLabel || "Offline"}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            <div className="rounded-md border p-3">
              <div className="text-xs text-gray-500">Projects (count)</div>
              <div className="text-xl text-gray-900">
                {typeof viewUser?.projectsCount === "number" ? viewUser.projectsCount : "—"}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-gray-500">Tasks (count)</div>
              <div className="text-xl text-gray-900">
                {typeof viewUser?.tasksCount === "number" ? viewUser.tasksCount : "—"}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ Details dialog (UPGRADED) */}
      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setDetailsUser(null);
            setDetailsPayload({});
            setDetailsLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeaderUI>
            <DialogTitleUI>User Details</DialogTitleUI>
            <DialogDescription>
              {detailsUser?.name || "—"} {canViewStats ? "(Admin/PM view)" : "(Read-only)"}
            </DialogDescription>
          </DialogHeaderUI>

          {!canViewStats ? (
            <div className="text-sm text-gray-600">
              Your role can view only basic information. Ask Admin/PM for workload details.
            </div>
          ) : detailsLoading ? (
            <div className="text-sm text-gray-500">Loading details...</div>
          ) : (
            <>
              {/* ✅ Summary strip */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Projects</div>
                  <div className="text-2xl text-gray-900 mt-1">{detailsProjects.length}</div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Total Tasks</div>
                  <div className="text-2xl text-gray-900 mt-1">{detailsCounts.total}</div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500 mb-2">Workload</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-lg text-gray-900">{detailsCounts.loadPct}%</div>
                    <Badge variant={detailsCounts.risk.variant}>{detailsCounts.risk.label}</Badge>
                  </div>
                  <div className="mt-2">
                    <Progress value={detailsCounts.loadPct} />
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500 mb-2">Task Status</div>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div className="flex justify-between">
                      <span>To Do</span>
                      <span>{detailsCounts.byStatus.todo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>In Progress</span>
                      <span>{detailsCounts.byStatus["in-progress"]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Done</span>
                      <span>{detailsCounts.byStatus.done}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500 mb-2">Projects</div>
                  {detailsProjects.length > 0 ? (
                    <ul className="text-sm text-gray-700 space-y-1 max-h-64 overflow-auto">
                      {detailsProjects.map((p: any) => (
                        <li key={p._id} className="truncate" title={p.name}>
                          • {p.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-500">No projects</div>
                  )}
                </div>

                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500 mb-2">Assigned Tasks</div>
                  {detailsTasks.length > 0 ? (
                    <ul className="text-sm text-gray-700 space-y-2 max-h-64 overflow-auto">
                      {detailsTasks.map((t: any) => (
                        <li key={t._id} className="border rounded-md p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium truncate" title={t.title}>
                              {t.title}
                            </div>
                            <Badge variant={t.status === "done" ? "default" : "outline"}>{t.status}</Badge>
                          </div>

                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <Flag className="w-3 h-3" />
                            <Badge variant={getPriorityVariant(t.priority)}>{t.priority}</Badge>

                            <span className="ml-auto flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {t?.projectId?.name || "Project"}
                            </span>
                          </div>

                          {t?.dueDate ? (
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(t.dueDate).toLocaleDateString()}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-500">No tasks</div>
                  )}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Task dialog */}
      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) {
            setAssignUser(null);
            resetAssignForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeaderUI>
            <DialogTitleUI>Assign Task</DialogTitleUI>
            <DialogDescription>
              Assign a task to <span className="font-medium">{assignUser?.name || "—"}</span>
            </DialogDescription>
          </DialogHeaderUI>

          {!canAssignTask ? (
            <div className="text-sm text-gray-600">Only Admin / Project Manager can assign tasks.</div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Project *</Label>
                <Select value={assignProjectId} onValueChange={setAssignProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder={projectsLoading ? "Loading projects..." : "Select project"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Select project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} placeholder="Task title" />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea rows={3} value={assignDescription} onChange={(e) => setAssignDescription(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={assignStatus} onValueChange={(v) => setAssignStatus(v as TaskStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={assignPriority} onValueChange={(v) => setAssignPriority(v as TaskPriority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitAssign} disabled={!canAssignTask || assigning}>
              {assigning ? "Assigning..." : "Assign Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetAdd();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeaderUI>
            <DialogTitleUI>Add Member</DialogTitleUI>
            <DialogDescription>
              {myRole === "project-manager"
                ? "Project Manager can add only Team Members."
                : "Create a new internal user (Admin / PM / Team)"}
            </DialogDescription>
          </DialogHeaderUI>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="John Doe" />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="john@company.com" />
            </div>

            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input value={addPassword} onChange={(e) => setAddPassword(e.target.value)} placeholder="Set a password" />
            </div>

            {myRole === "admin" ? (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={addRole} onValueChange={(v) => setAddRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="project-manager">Project Manager</SelectItem>
                    <SelectItem value="team-member">Team Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                Role: <span className="font-medium">Team Member</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={addMember} disabled={adding}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit role dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeaderUI>
            <DialogTitleUI>Edit User</DialogTitleUI>
            <DialogDescription>Change role (Admin only)</DialogDescription>
          </DialogHeaderUI>

          <div className="space-y-4 py-2">
            <div className="text-sm text-gray-700">
              <div className="font-medium text-gray-900">{editingUser?.name}</div>
              <div className="text-xs text-gray-500">{editingUser?.email}</div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="project-manager">Project Manager</SelectItem>
                  <SelectItem value="team-member">Team Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveRole} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm enable/disable */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setConfirmUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeaderUI>
            <DialogTitleUI>Confirm action</DialogTitleUI>
            <DialogDescription>
              {(() => {
                const active = typeof confirmUser?.isActive === "boolean" ? confirmUser.isActive : true;
                return active ? "This will disable the user and prevent login." : "This will enable the user and allow login.";
              })()}
            </DialogDescription>
          </DialogHeaderUI>

          <div className="text-sm text-gray-700">
            <div className="font-medium text-gray-900">{confirmUser?.name}</div>
            <div className="text-xs text-gray-500">{confirmUser?.email}</div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={(() => {
                const active = typeof confirmUser?.isActive === "boolean" ? confirmUser.isActive : true;
                return active ? "destructive" : "default";
              })()}
              onClick={toggleUser}
            >
              {(() => {
                const active = typeof confirmUser?.isActive === "boolean" ? confirmUser.isActive : true;
                return active ? "Disable" : "Enable";
              })()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeaderUI>
            <DialogTitleUI>Delete user?</DialogTitleUI>
            <DialogDescription>This permanently removes the user account.</DialogDescription>
          </DialogHeaderUI>

          <div className="text-sm text-gray-700">
            <div className="font-medium text-gray-900">{deleteUser?.name}</div>
            <div className="text-xs text-gray-500">{deleteUser?.email}</div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={doDeleteUser}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
