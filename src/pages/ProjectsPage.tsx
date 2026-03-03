import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Users,
  Calendar,
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  Pencil,
  Archive,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";

type ProjectStatus = "planning" | "active" | "on-hold" | "completed";
type ProjectPriority = "low" | "medium" | "high";
type FilterValue = ProjectStatus | "all" | "archived";

//Backend task status is "done" (not "completed")
type TaskStatus = "todo" | "in-progress" | "done";

const clampProgress = (n: number) => Math.max(0, Math.min(100, n));
const NONE = "__none__";

//Safety handler for Radix DropdownMenuItem
const safeSelect =
  (fn: () => void) =>
  (e: Event) => {
    e.preventDefault();
    // @ts-ignore
    e.stopPropagation?.();
    fn();
  };

const normalizeRole = (role: any) => {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "admin";
  if (r === "project-manager" || r === "projectmanager" || r === "project manager" || r === "pm")
    return "project-manager";
  if (r === "team-member" || r === "teammember" || r === "team member" || r === "member")
    return "team-member";
  if (r === "client") return "client";
  return r;
};

export function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>("all");

  const [projects, setProjects] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const role = normalizeRole(currentUser?.role);
  const isAdmin = role === "admin";
  const isPM = role === "project-manager";
  const isTeam = role === "team-member";
  const isClient = role === "client";

  //permissions (backend still enforces)
  const canCreateProject = isAdmin || isPM;
  const canEditProject = isAdmin || isPM;
  const canDelete = isAdmin || isPM;
  const canAssignManager = isAdmin || isPM; 
  const canAssignMembers = isAdmin || isPM;

  //tasks permissions
  const canUpdateTasks = isAdmin || isPM;
  const canSeeTasks = isAdmin || isPM || isTeam || isClient;

  // CREATE DIALOG
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<ProjectStatus>("planning");
  const [formPriority, setFormPriority] = useState<ProjectPriority>("medium");
  const [formBudgetAllocated, setFormBudgetAllocated] = useState<string>("");
  const [formDueDate, setFormDueDate] = useState<string>("");

  const [formManagerId, setFormManagerId] = useState<string>(NONE);
  const [formMemberIds, setFormMemberIds] = useState<string[]>([]);
  const [memberPick, setMemberPick] = useState<string>(NONE);

  // VIEW DETAILS DIALOG + TASKS
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<any>(null);

  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);

  // EDIT DIALOG
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectStatus>("planning");
  const [editPriority, setEditPriority] = useState<ProjectPriority>("medium");
  const [editBudgetAllocated, setEditBudgetAllocated] = useState<string>("0");
  const [editDueDate, setEditDueDate] = useState<string>("");

  // ASSIGN MANAGER DIALOG
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerTarget, setManagerTarget] = useState<any>(null);
  const [managerPick, setManagerPick] = useState<string>(NONE);
  const [savingManager, setSavingManager] = useState(false);

  // ASSIGN MEMBERS DIALOG
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersTarget, setMembersTarget] = useState<any>(null);
  const [membersPickIds, setMembersPickIds] = useState<string[]>([]);
  const [membersPick, setMembersPick] = useState<string>(NONE);
  const [savingMembers, setSavingMembers] = useState(false);

  // DELETE CONFIRM
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------- LOADERS ----------------
  const loadProjects = async () => {
    try {
      const res = await api.get("/projects");
      const list = Array.isArray(res.data?.projects) ? res.data.projects : [];
      setProjects(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load projects");
      setProjects([]);
    }
  };

  const loadUsers = async () => {
    try {
      if (!isAdmin && !isPM) {
        setUsersList([]);
        return;
      }
      const res = await api.get("/users");
      const list = Array.isArray(res.data?.users) ? res.data.users : [];
      setUsersList(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load users");
      setUsersList([]);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadProjects(), loadUsers()]);
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- HELPERS ----------------
  const resetCreateForm = () => {
    setFormName("");
    setFormDescription("");
    setFormStatus("planning");
    setFormPriority("medium");
    setFormBudgetAllocated("");
    setFormDueDate("");
    setFormManagerId(NONE);
    setFormMemberIds([]);
    setMemberPick(NONE);
  };

  const addMemberCreate = (id: string) => {
    if (!id || id === NONE) return;
    setFormMemberIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const removeMemberCreate = (id: string) => {
    setFormMemberIds((prev) => prev.filter((x) => x !== id));
  };

  const getManagerName = (project: any) => {
    if (project?.projectManager?.name) return project.projectManager.name;
    const found = usersList.find((u) => u._id === project?.projectManager);
    return found?.name || "Not assigned";
  };

  const getBudgetAllocated = (project: any) => {
    if (project?.budget?.allocated != null) return Number(project.budget.allocated);
    return 0;
  };

  const getProgress = (project: any) => {
    if (project?.progress != null) return clampProgress(Number(project.progress));
    const total = Number(project?.taskStats?.total || 0);
    const completed = Number(project?.taskStats?.completed || 0);
    return total > 0 ? clampProgress(Math.round((completed / total) * 100)) : 0;
  };

  const getDueDate = (project: any) => {
    const d = project?.dueDate;
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return "-";
    }
  };

  const getMemberCount = (project: any) => {
    return Array.isArray(project?.members) ? project.members.length : 0;
  };

  // ---------------- TASKS ----------------
  const loadProjectTasks = async (projectId: string) => {
    if (!canSeeTasks) return;
    setTasksLoading(true);
    try {
      //match your backend task.routes.js
      const res = await api.get(`/projects/${projectId}/tasks`);
      const list = Array.isArray(res.data?.tasks) ? res.data.tasks : [];
      setTasks(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (!canUpdateTasks) return;
    try {
      
      await api.patch(`/tasks/${taskId}`, { status });

      toast.success("Task updated");
      if (viewTarget?._id) {
        await Promise.all([loadProjectTasks(viewTarget._id), loadProjects()]);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update task");
    }
  };

  // ---------------- CREATE ----------------
  const handleCreateProject = async () => {
    if (!canCreateProject) {
      toast.error("Not allowed to create projects");
      return;
    }

    if (!formName.trim()) {
      toast.error("Project name is required");
      return;
    }

    const budgetNum = formBudgetAllocated ? Number(formBudgetAllocated) : 0;
    if (Number.isNaN(budgetNum) || budgetNum < 0) {
      toast.error("Budget must be a valid number");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim(),
        status: formStatus,
        priority: formPriority,
        projectManager: formManagerId === NONE ? null : formManagerId,
        members: formMemberIds,
        budgetAllocated: budgetNum,
        dueDate: formDueDate ? formDueDate : null,
      };

      const res = await api.post("/projects", payload);
      toast.success(res.data?.message || "Project created");

      const created = res.data?.project;
      if (created) setProjects((prev) => [created, ...prev]);
      else await loadProjects();

      setIsCreateDialogOpen(false);
      resetCreateForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  // ---------------- MENU ACTIONS ----------------
  const openViewDetails = async (project: any) => {
    setViewTarget(project);
    setViewOpen(true);
    setTasks([]);
    if (project?._id) await loadProjectTasks(project._id);
  };

  const openEditProject = (project: any) => {
    setEditTarget(project);

    setEditName(project?.name || "");
    setEditDescription(project?.description || "");
    setEditStatus((project?.status || "planning") as ProjectStatus);
    setEditPriority((project?.priority || "medium") as ProjectPriority);
    setEditBudgetAllocated(String(getBudgetAllocated(project)));
    setEditDueDate(project?.dueDate ? new Date(project.dueDate).toISOString().slice(0, 10) : "");

    setEditOpen(true);
  };

  const saveEditProject = async () => {
    if (!editTarget?._id) return;

    if (!editName.trim()) {
      toast.error("Project name is required");
      return;
    }

    const budgetNum = editBudgetAllocated ? Number(editBudgetAllocated) : 0;
    if (Number.isNaN(budgetNum) || budgetNum < 0) {
      toast.error("Budget must be a valid number");
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        name: editName.trim(),
        description: editDescription.trim(),
        status: editStatus,
        priority: editPriority,
        budgetAllocated: budgetNum,
        dueDate: editDueDate ? editDueDate : null,
      };

      await api.patch(`/projects/${editTarget._id}`, payload);
      toast.success("Project updated");

      await loadProjects();
      setEditOpen(false);
      setEditTarget(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update project");
    } finally {
      setSavingEdit(false);
    }
  };

  const changeStatus = async (project: any, status: ProjectStatus) => {
    try {
      await api.patch(`/projects/${project._id}`, { status });
      toast.success("Status updated");
      await loadProjects();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update status");
    }
  };

  const openAssignManager = (project: any) => {
    setManagerTarget(project);
    const current = project?.projectManager?._id || project?.projectManager;
    setManagerPick(current ? String(current) : NONE);
    setManagerOpen(true);
  };

  const saveManager = async () => {
    if (!managerTarget?._id) return;
    setSavingManager(true);
    try {
      await api.patch(`/projects/${managerTarget._id}`, {
        projectManager: managerPick === NONE ? null : managerPick,
      });
      toast.success("Manager updated");
      await loadProjects();
      setManagerOpen(false);
      setManagerTarget(null);
      setManagerPick(NONE);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update manager");
    } finally {
      setSavingManager(false);
    }
  };

  const openAssignMembers = (project: any) => {
    setMembersTarget(project);

    const ids =
      Array.isArray(project?.members) && project.members.length > 0
        ? project.members
            .map((m: any) => (typeof m === "string" ? m : m?._id))
            .filter(Boolean)
            .map(String)
        : [];

    setMembersPickIds(ids);
    setMembersPick(NONE);
    setMembersOpen(true);
  };

  const addMemberAssign = (id: string) => {
    if (!id || id === NONE) return;
    setMembersPickIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeMemberAssign = (id: string) => {
    setMembersPickIds((prev) => prev.filter((x) => x !== id));
  };

  const saveMembers = async () => {
    if (!membersTarget?._id) return;
    setSavingMembers(true);
    try {
      await api.patch(`/projects/${membersTarget._id}`, { members: membersPickIds });
      toast.success("Members updated");
      await loadProjects();
      setMembersOpen(false);
      setMembersTarget(null);
      setMembersPickIds([]);
      setMembersPick(NONE);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update members");
    } finally {
      setSavingMembers(false);
    }
  };

  const archiveProject = async (project: any) => {
    try {
      const nextArchived = !Boolean(project.archived);
      await api.patch(`/projects/${project._id}/archive`, { archived: nextArchived });
      toast.success(nextArchived ? "Archived" : "Unarchived");
      await loadProjects();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to archive project");
    }
  };

  const requestDelete = (project: any) => {
    setDeleteTarget(project);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${deleteTarget._id}`);
      toast.success("Project deleted");
      setProjects((prev) => prev.filter((p) => p._id !== deleteTarget._id));
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete project");
      setDeleteOpen(true);
    } finally {
      setDeleting(false);
    }
  };

  // ---------------- FILTER/STATS ----------------
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        (p?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p?.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      const isArchived = Boolean(p?.archived);

      if (selectedFilter === "archived") {
        return matchesSearch && isArchived;
      }

      if (isArchived) return false;

      const matchesStatus = selectedFilter === "all" || p?.status === selectedFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, selectedFilter]);

  const stats = useMemo(() => {
    const activeList = projects.filter((p) => !p?.archived);
    return {
      total: activeList.length,
      planning: activeList.filter((p) => p.status === "planning").length,
      active: activeList.filter((p) => p.status === "active").length,
      completed: activeList.filter((p) => p.status === "completed").length,
    };
  }, [projects]);

  const statusBadgeVariant = (status: ProjectStatus) => {
    if (status === "completed") return "default";
    if (status === "active") return "secondary";
    if (status === "on-hold") return "destructive";
    return "outline";
  };

  const statusLabel = (status: ProjectStatus) => {
    if (status === "on-hold") return "On Hold";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-3xl text-gray-900">Projects</h1>
        <p className="text-gray-600">Loading projects...</p>
      </div>
    );
  }

  // dropdown lists
  const managerOptionsAll = usersList.filter((u) => normalizeRole(u.role) === "project-manager");
  const memberOptions = usersList.filter((u) => normalizeRole(u.role) === "team-member");

  const selectedMembersObjectsCreate = usersList.filter((u) => formMemberIds.includes(u._id));
  const selectedMembersObjectsAssign = usersList.filter((u) => membersPickIds.includes(u._id));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Projects</h1>
          <p className="text-gray-600">
            {isClient ? "Client view (read-only progress)" : isTeam ? "Team view" : isPM ? "Project Manager view" : "Admin view"}
          </p>
        </div>

        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) resetCreateForm();
          }}
        >
          {canCreateProject && (
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
          )}

          <DialogContent className="max-w-2xl p-0">
            <div className="flex flex-col max-h-[85vh]">
              <div className="p-6 pb-0">
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>Create a project and assign Members</DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-6 pt-4 overflow-y-auto flex-1">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Project Name</Label>
                    <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={formStatus} onValueChange={(v) => setFormStatus(v as ProjectStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on-hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={formPriority} onValueChange={(v) => setFormPriority(v as ProjectPriority)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Budget (Allocated)</Label>
                    <Input type="number" value={formBudgetAllocated} onChange={(e) => setFormBudgetAllocated(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Project Manager (optional)</Label>
                    <Select value={formManagerId} onValueChange={setFormManagerId}>
                      <SelectTrigger><SelectValue placeholder="Select a manager" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No manager</SelectItem>
                        {managerOptionsAll.map((u) => (
                          <SelectItem key={u._id} value={u._id}>
                            {u.name} ({u.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isPM && <div className="text-xs text-gray-500">If you don’t select a manager, it defaults to you.</div>}
                  </div>

                  <div className="space-y-2">
                    <Label>Members (optional) — Team Members only</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <Select value={memberPick} onValueChange={setMemberPick}>
                          <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Select team member</SelectItem>
                            {memberOptions.map((u) => (
                              <SelectItem key={u._id} value={u._id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!memberPick || memberPick === NONE) return;
                          addMemberCreate(memberPick);
                          setMemberPick(NONE);
                        }}
                      >
                        Add
                      </Button>
                    </div>

                    {selectedMembersObjectsCreate.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {selectedMembersObjectsCreate.map((m) => (
                          <span
                            key={m._id}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm"
                          >
                            {m.name}
                            <button
                              type="button"
                              className="text-gray-500 hover:text-gray-900"
                              onClick={() => removeMemberCreate(m._id)}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 pt-4 border-t bg-white">
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleCreateProject} disabled={creating}>
                    {creating ? "Creating..." : "Create Project"}
                  </Button>
                </DialogFooter>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-500">Total</p><p className="text-2xl text-gray-900 mt-1">{stats.total}</p></div>
            <Target className="w-8 h-8 text-blue-600" />
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-500">Planning</p><p className="text-2xl text-gray-900 mt-1">{stats.planning}</p></div>
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-500">Active</p><p className="text-2xl text-gray-900 mt-1">{stats.active}</p></div>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-500">Completed</p><p className="text-2xl text-gray-900 mt-1">{stats.completed}</p></div>
            <Clock className="w-8 h-8 text-gray-600" />
          </div>
        </CardContent></Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search projects..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={selectedFilter} onValueChange={(v) => setSelectedFilter(v as FilterValue)}>
          <SelectTrigger className="w-56">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on-hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const allocated = getBudgetAllocated(project);
          const progress = getProgress(project);
          const totalTasks = Number(project?.taskStats?.total || 0);
          const completedTasks = Number(project?.taskStats?.completed || 0);

          return (
            <Card key={project._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{project.name}</CardTitle>
                    <p className="text-sm text-gray-600">{project.description}</p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>

                      <DropdownMenuItem onSelect={safeSelect(() => openViewDetails(project))}>
                        <Eye className="w-4 h-4 mr-2" /> View Details
                      </DropdownMenuItem>

                      {canEditProject && (
                        <DropdownMenuItem onSelect={safeSelect(() => openEditProject(project))}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit Project
                        </DropdownMenuItem>
                      )}

                      {canEditProject && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-48">
                            <DropdownMenuItem onSelect={safeSelect(() => changeStatus(project, "active"))}>Active</DropdownMenuItem>
                            <DropdownMenuItem onSelect={safeSelect(() => changeStatus(project, "completed"))}>Completed</DropdownMenuItem>
                            <DropdownMenuItem onSelect={safeSelect(() => changeStatus(project, "on-hold"))}>On Hold</DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}

                      {canAssignManager && (
                        <DropdownMenuItem onSelect={safeSelect(() => openAssignManager(project))}>
                          <UserCog className="w-4 h-4 mr-2" /> Assign / Change Manager
                        </DropdownMenuItem>
                      )}

                      {canAssignMembers && (
                        <DropdownMenuItem onSelect={safeSelect(() => openAssignMembers(project))}>
                          <UserPlus className="w-4 h-4 mr-2" /> Assign / Change Members
                        </DropdownMenuItem>
                      )}

                      {canEditProject && (
                        <DropdownMenuItem onSelect={safeSelect(() => archiveProject(project))}>
                          <Archive className="w-4 h-4 mr-2" /> {project.archived ? "Unarchive" : "Archive"}
                        </DropdownMenuItem>
                      )}

                      {canDelete && <DropdownMenuSeparator />}

                      {canDelete && (
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={safeSelect(() => requestDelete(project))}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(project.status)}>{statusLabel(project.status)}</Badge>
                  <Badge variant="outline">{project.priority} priority</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="text-gray-900">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                  <div className="text-xs text-gray-500">
                    {completedTasks} / {totalTasks} tasks completed
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{getMemberCount(project)} members</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{getDueDate(project)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  <span>
                    Budget: <span className="text-gray-900">{allocated.toLocaleString()}</span>
                  </span>
                </div>

                <div className="text-xs text-gray-500">
                  Manager: <span className="text-gray-900">{getManagerName(project)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProjects.length === 0 && <div className="text-gray-500 text-sm">No projects found.</div>}

      {/* View Details (includes tasks by role) */}
      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) {
            setViewTarget(null);
            setTasks([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Project Details</DialogTitle>
            <DialogDescription>{viewTarget?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div><span className="text-gray-500">Description: </span>{viewTarget?.description || "-"}</div>
            <div><span className="text-gray-500">Status: </span>{viewTarget?.status}</div>
            <div><span className="text-gray-500">Priority: </span>{viewTarget?.priority}</div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Progress</span>
                <span className="text-gray-900">{getProgress(viewTarget)}%</span>
              </div>
              <Progress value={getProgress(viewTarget)} />
              <div className="text-xs text-gray-500">
                {Number(viewTarget?.taskStats?.completed || 0)} / {Number(viewTarget?.taskStats?.total || 0)} tasks completed
              </div>
            </div>

            <div><span className="text-gray-500">Budget: </span>{getBudgetAllocated(viewTarget).toLocaleString()}</div>
            <div><span className="text-gray-500">Due Date: </span>{getDueDate(viewTarget)}</div>
            <div><span className="text-gray-500">Manager: </span>{getManagerName(viewTarget)}</div>
            <div><span className="text-gray-500">Members: </span>{getMemberCount(viewTarget)}</div>
          </div>

          {/* ✅ Tasks (role-based) */}
          {canSeeTasks && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">
                  {isTeam ? "My Tasks" : "Project Tasks"}
                  {isClient && " (read-only)"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => viewTarget?._id && loadProjectTasks(viewTarget._id)}
                  disabled={tasksLoading}
                >
                  {tasksLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>

              {tasksLoading ? (
                <div className="text-sm text-gray-500">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="text-sm text-gray-500">No tasks found.</div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div key={t._id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-xs text-gray-500">
                          Assigned: {t?.assignedTo?.name || "Unassigned"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={t.status === "done" ? "default" : "outline"}>
                          {t.status}
                        </Badge>

                        {/* ✅ PM/Admin can update tasks */}
                        {canUpdateTasks && !isClient && (
                          <Select
                            value={t.status}
                            onValueChange={(v) => updateTaskStatus(t._id, v as TaskStatus)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">todo</SelectItem>
                              <SelectItem value="in-progress">in-progress</SelectItem>
                              <SelectItem value="done">done</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ProjectStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v as ProjectPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Budget (Allocated)</Label>
              <Input type="number" value={editBudgetAllocated} onChange={(e) => setEditBudgetAllocated(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>Cancel</Button>
            <Button type="button" onClick={saveEditProject} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Manager */}
      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign / Change Manager</DialogTitle>
            <DialogDescription>{managerTarget?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Project Manager</Label>
            <Select value={managerPick} onValueChange={setManagerPick}>
              <SelectTrigger><SelectValue placeholder="Select a manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No manager</SelectItem>
                {managerOptionsAll.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManagerOpen(false)} disabled={savingManager}>Cancel</Button>
            <Button type="button" onClick={saveManager} disabled={savingManager}>
              {savingManager ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Members */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Assign / Change Members</DialogTitle>
            <DialogDescription>{membersTarget?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label>Add team member</Label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Select value={membersPick} onValueChange={setMembersPick}>
                  <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Select team member</SelectItem>
                    {memberOptions.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!membersPick || membersPick === NONE) return;
                  addMemberAssign(membersPick);
                  setMembersPick(NONE);
                }}
              >
                Add
              </Button>
            </div>

            {selectedMembersObjectsAssign.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedMembersObjectsAssign.map((m) => (
                  <span key={m._id} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm">
                    {m.name}
                    <button type="button" className="text-gray-500 hover:text-gray-900" onClick={() => removeMemberAssign(m._id)}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No members selected</div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMembersOpen(false)} disabled={savingMembers}>
              Cancel
            </Button>
            <Button type="button" onClick={saveMembers} disabled={savingMembers}>
              {savingMembers ? "Saving..." : "Save Members"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-medium">{deleteTarget?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

