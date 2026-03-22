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
  LayoutGrid,
  List,
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
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { formatDateByPreference } from "@/lib/dateFormat";

type ProjectStatus = "planning" | "active" | "on-hold" | "completed";
type ProjectPriority = "low" | "medium" | "high";
type FilterValue = ProjectStatus | "all" | "archived";
type TaskStatus = "todo" | "in-progress" | "done";
type ProjectViewMode = "grid" | "list";

const clampProgress = (n: number) => Math.max(0, Math.min(100, n));
const NONE = "__none__";

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

  const [viewMode, setViewMode] = useState<ProjectViewMode>("grid");
  const [showCompletedProjects, setShowCompletedProjects] = useState(true);

  const { preferences, loadingPreferences } = useUserPreferences();
  const compactMode = preferences.compactMode;

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

  const canCreateProject = isAdmin || isPM;
  const canEditProject = isAdmin || isPM;
  const canDelete = isAdmin || isPM;
  const canAssignManager = isAdmin || isPM;
  const canAssignMembers = isAdmin || isPM;

  const canUpdateTasks = isAdmin || isPM;
  const canSeeTasks = isAdmin || isPM || isTeam || isClient;

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

  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<any>(null);

  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectStatus>("planning");
  const [editPriority, setEditPriority] = useState<ProjectPriority>("medium");
  const [editBudgetAllocated, setEditBudgetAllocated] = useState<string>("0");
  const [editDueDate, setEditDueDate] = useState<string>("");

  const [managerOpen, setManagerOpen] = useState(false);
  const [managerTarget, setManagerTarget] = useState<any>(null);
  const [managerPick, setManagerPick] = useState<string>(NONE);
  const [savingManager, setSavingManager] = useState(false);

  const [membersOpen, setMembersOpen] = useState(false);
  const [membersTarget, setMembersTarget] = useState<any>(null);
  const [membersPickIds, setMembersPickIds] = useState<string[]>([]);
  const [membersPick, setMembersPick] = useState<string>(NONE);
  const [savingMembers, setSavingMembers] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const pagePadding = compactMode ? "p-4" : "p-6";
  const sectionSpacing = compactMode ? "space-y-4" : "space-y-6";
  const titleClass = compactMode ? "text-2xl font-semibold mb-1" : "text-3xl font-semibold mb-2";
  const subtitleClass = compactMode ? "text-sm text-muted-foreground" : "text-muted-foreground";
  const gridGap = compactMode ? "gap-3" : "gap-4";
  const cardGridGap = compactMode ? "gap-4" : "gap-6";
  const cardTopPadding = compactMode ? "pt-4" : "pt-6";
  const cardHeaderPadding = compactMode ? "pb-2" : "pb-4";
  const metricValueClass = compactMode ? "text-xl font-semibold mt-1" : "text-2xl font-semibold mt-1";
  const cardTitleClass = compactMode ? "text-base" : "text-lg";
  const progressHeight = compactMode ? "h-2" : "h-3";
  const buttonCompactClass = compactMode ? "h-9 px-3" : "";
  const selectTriggerCompactClass = compactMode ? "h-9" : "";
  const listSpacing = compactMode ? "space-y-3" : "space-y-4";
  const innerSpacing = compactMode ? "space-y-1.5" : "space-y-2";
  const dialogFieldSpacing = compactMode ? "space-y-3" : "space-y-4";
  const dialogGridGap = compactMode ? "gap-3" : "gap-4";
  const descriptionRows = compactMode ? 2 : 3;

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

  const loadProjectPreferences = async () => {
    try {
      const res = await api.get("/settings/me");
      const defaultView = res?.data?.preferences?.defaultProjectView;
      const showCompleted = res?.data?.preferences?.showCompletedTasks;

      if (defaultView === "list") {
        setViewMode("list");
      } else {
        setViewMode("grid");
      }

      setShowCompletedProjects(showCompleted ?? true);
    } catch {
      setViewMode("grid");
      setShowCompletedProjects(true);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadProjects(), loadUsers(), loadProjectPreferences()]);
      setLoading(false);
    };
    init();
  }, []);

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
      return formatDateByPreference(d, preferences.dateFormat);
    } catch {
      return "-";
    }
  };

  const getMemberCount = (project: any) => {
    return Array.isArray(project?.members) ? project.members.length : 0;
  };

  const loadProjectTasks = async (projectId: string) => {
    if (!canSeeTasks) return;
    setTasksLoading(true);
    try {
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
      if (!matchesStatus) return false;

      if (!showCompletedProjects && p?.status === "completed") return false;

      return matchesSearch;
    });
  }, [projects, searchQuery, selectedFilter, showCompletedProjects]);

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

  if (loading || loadingPreferences) {
    return (
      <div className={`${pagePadding} space-y-2 bg-background text-foreground`}>
        <h1 className={compactMode ? "text-2xl font-semibold" : "text-3xl font-semibold"}>Projects</h1>
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  const managerOptionsAll = usersList.filter((u) => normalizeRole(u.role) === "project-manager");
  const memberOptions = usersList.filter((u) => normalizeRole(u.role) === "team-member");

  const selectedMembersObjectsCreate = usersList.filter((u) => formMemberIds.includes(u._id));
  const selectedMembersObjectsAssign = usersList.filter((u) => membersPickIds.includes(u._id));

  return (
    <div className={`${pagePadding} ${sectionSpacing} bg-background text-foreground`}>
      <div className={`flex items-center justify-between flex-wrap ${gridGap}`}>
        <div>
          <h1 className={titleClass}>Projects</h1>
          <p className={subtitleClass}>
            {isClient
              ? "Client view (read-only progress)"
              : isTeam
              ? "Team view"
              : isPM
              ? "Project Manager view"
              : "Admin view"}
          </p>
        </div>

        <div className={`flex items-center gap-2 flex-wrap`}>
          <Button
            type="button"
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className={buttonCompactClass}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Grid
          </Button>

          <Button
            type="button"
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className={buttonCompactClass}
          >
            <List className="w-4 h-4 mr-2" />
            List
          </Button>

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) resetCreateForm();
            }}
          >
            {canCreateProject && (
              <DialogTrigger asChild>
                <Button type="button" className={buttonCompactClass}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
            )}

            <DialogContent className="max-w-2xl p-0 border-border bg-card text-card-foreground">
              <div className="flex flex-col max-h-[85vh]">
                <div className="p-6 pb-0">
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>Create a project and assign members</DialogDescription>
                  </DialogHeader>
                </div>

                <div className="p-6 pt-4 overflow-y-auto flex-1">
                  <div className={dialogFieldSpacing}>
                    <div className="space-y-2">
                      <Label>Project Name</Label>
                      <Input
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className={selectTriggerCompactClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        rows={descriptionRows}
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                      />
                    </div>

                    <div className={`grid grid-cols-2 ${dialogGridGap}`}>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={formStatus} onValueChange={(v) => setFormStatus(v as ProjectStatus)}>
                          <SelectTrigger className={selectTriggerCompactClass}>
                            <SelectValue />
                          </SelectTrigger>
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
                          <SelectTrigger className={selectTriggerCompactClass}>
                            <SelectValue />
                          </SelectTrigger>
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
                      <Input
                        type="number"
                        value={formBudgetAllocated}
                        onChange={(e) => setFormBudgetAllocated(e.target.value)}
                        className={selectTriggerCompactClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        className={selectTriggerCompactClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Project Manager (optional)</Label>
                      <Select value={formManagerId} onValueChange={setFormManagerId}>
                        <SelectTrigger className={selectTriggerCompactClass}>
                          <SelectValue placeholder="Select a manager" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>No manager</SelectItem>
                          {managerOptionsAll.map((u) => (
                            <SelectItem key={u._id} value={u._id}>
                              {u.name} ({u.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isPM && (
                        <div className="text-xs text-muted-foreground">
                          If you don’t select a manager, it defaults to you.
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Members (optional) — Team Members only</Label>
                      <div className={`grid grid-cols-1 md:grid-cols-3 ${compactMode ? "gap-2.5" : "gap-3"}`}>
                        <div className="md:col-span-2">
                          <Select value={memberPick} onValueChange={setMemberPick}>
                            <SelectTrigger className={selectTriggerCompactClass}>
                              <SelectValue placeholder="Select team member" />
                            </SelectTrigger>
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
                          className={buttonCompactClass}
                        >
                          Add
                        </Button>
                      </div>

                      {selectedMembersObjectsCreate.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {selectedMembersObjectsCreate.map((m) => (
                            <span
                              key={m._id}
                              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-foreground text-sm"
                            >
                              {m.name}
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
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

                <div className="p-6 pt-4 border-t border-border bg-card">
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      className={buttonCompactClass}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCreateProject}
                      disabled={creating}
                      className={buttonCompactClass}
                    >
                      {creating ? "Creating..." : "Create Project"}
                    </Button>
                  </DialogFooter>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-4 ${gridGap}`}>
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPadding}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className={metricValueClass}>{stats.total}</p>
              </div>
              <Target className={compactMode ? "w-7 h-7 text-blue-600" : "w-8 h-8 text-blue-600"} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPadding}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Planning</p>
                <p className={metricValueClass}>{stats.planning}</p>
              </div>
              <AlertCircle className={compactMode ? "w-7 h-7 text-yellow-600" : "w-8 h-8 text-yellow-600"} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPadding}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className={metricValueClass}>{stats.active}</p>
              </div>
              <CheckCircle2 className={compactMode ? "w-7 h-7 text-green-600" : "w-8 h-8 text-green-600"} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className={cardTopPadding}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className={metricValueClass}>{stats.completed}</p>
              </div>
              <Clock className={compactMode ? "w-7 h-7 text-muted-foreground" : "w-8 h-8 text-muted-foreground"} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={`flex ${gridGap} flex-wrap`}>
        <div className="flex-1 relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects..."
            className={`pl-10 ${selectTriggerCompactClass}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={selectedFilter} onValueChange={(v) => setSelectedFilter(v as FilterValue)}>
          <SelectTrigger className={`w-56 ${selectTriggerCompactClass}`}>
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

      {viewMode === "grid" ? (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${cardGridGap}`}>
          {filteredProjects.map((project) => {
            const allocated = getBudgetAllocated(project);
            const progress = getProgress(project);
            const totalTasks = Number(project?.taskStats?.total || 0);
            const completedTasks = Number(project?.taskStats?.completed || 0);

            return (
              <Card
                key={project._id}
                className="border-border bg-card text-card-foreground hover:shadow-lg transition-shadow"
              >
                <CardHeader className={cardHeaderPadding}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <CardTitle className={`${cardTitleClass} mb-2`}>{project.name}</CardTitle>
                      <p className={compactMode ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
                        {project.description}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className={compactMode ? "h-8 w-8" : ""}>
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
                              <DropdownMenuItem onSelect={safeSelect(() => changeStatus(project, "active"))}>
                                Active
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={safeSelect(() => changeStatus(project, "completed"))}>
                                Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={safeSelect(() => changeStatus(project, "on-hold"))}>
                                On Hold
                              </DropdownMenuItem>
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
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onSelect={safeSelect(() => requestDelete(project))}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={statusBadgeVariant(project.status)}>{statusLabel(project.status)}</Badge>
                    <Badge variant="outline">{project.priority} priority</Badge>
                  </div>
                </CardHeader>

                <CardContent className={compactMode ? "space-y-3" : "space-y-4"}>
                  <div className={innerSpacing}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="text-card-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className={progressHeight} />
                    <div className="text-xs text-muted-foreground">
                      {completedTasks} / {totalTasks} tasks completed
                    </div>
                  </div>

                  <div className={`grid grid-cols-2 ${dialogGridGap} text-sm`}>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className={compactMode ? "w-3.5 h-3.5" : "w-4 h-4"} />
                      <span>{getMemberCount(project)} members</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className={compactMode ? "w-3.5 h-3.5" : "w-4 h-4"} />
                      <span>{getDueDate(project)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className={compactMode ? "w-3.5 h-3.5" : "w-4 h-4"} />
                    <span>
                      Budget: <span className="text-card-foreground">{allocated.toLocaleString()}</span>
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Manager: <span className="text-card-foreground">{getManagerName(project)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className={listSpacing}>
          {filteredProjects.map((project) => {
            const allocated = getBudgetAllocated(project);
            const progress = getProgress(project);
            const totalTasks = Number(project?.taskStats?.total || 0);
            const completedTasks = Number(project?.taskStats?.completed || 0);

            return (
              <Card key={project._id} className="border-border bg-card text-card-foreground">
                <CardContent className={cardTopPadding}>
                  <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between ${gridGap}`}>
                    <div className={`${innerSpacing} flex-1 min-w-0`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={compactMode ? "text-base font-semibold" : "text-lg font-semibold"}>
                          {project.name}
                        </h3>
                        <Badge variant={statusBadgeVariant(project.status)}>{statusLabel(project.status)}</Badge>
                        <Badge variant="outline">{project.priority} priority</Badge>
                      </div>

                      <p className={compactMode ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>
                        {project.description}
                      </p>

                      <div className={`flex flex-wrap ${gridGap} text-sm text-muted-foreground`}>
                        <span className="flex items-center gap-2">
                          <Users className={compactMode ? "w-3.5 h-3.5" : "w-4 h-4"} />
                          {getMemberCount(project)} members
                        </span>
                        <span className="flex items-center gap-2">
                          <Calendar className={compactMode ? "w-3.5 h-3.5" : "w-4 h-4"} />
                          {getDueDate(project)}
                        </span>
                        <span className="flex items-center gap-2">
                          <DollarSign className={compactMode ? "w-3.5 h-3.5" : "w-4 h-4"} />
                          {allocated.toLocaleString()}
                        </span>
                      </div>

                      <div className={`${innerSpacing} max-w-xl`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-card-foreground">{progress}%</span>
                        </div>
                        <Progress value={progress} className={progressHeight} />
                        <div className="text-xs text-muted-foreground">
                          {completedTasks} / {totalTasks} tasks completed • Manager:{" "}
                          <span className="text-card-foreground">{getManagerName(project)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openViewDetails(project)}
                        className={buttonCompactClass}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>

                      {canEditProject && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditProject(project)}
                          className={buttonCompactClass}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredProjects.length === 0 && (
        <div className="text-muted-foreground text-sm">No projects found.</div>
      )}

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
        <DialogContent className="max-w-2xl border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Project Details</DialogTitle>
            <DialogDescription>{viewTarget?.name}</DialogDescription>
          </DialogHeader>

          <div className={compactMode ? "space-y-2.5 text-sm" : "space-y-3 text-sm"}>
            <div>
              <span className="text-muted-foreground">Description: </span>
              {viewTarget?.description || "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Status: </span>
              {viewTarget?.status}
            </div>
            <div>
              <span className="text-muted-foreground">Priority: </span>
              {viewTarget?.priority}
            </div>

            <div className={innerSpacing}>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-card-foreground">{getProgress(viewTarget)}%</span>
              </div>
              <Progress value={getProgress(viewTarget)} className={progressHeight} />
              <div className="text-xs text-muted-foreground">
                {Number(viewTarget?.taskStats?.completed || 0)} / {Number(viewTarget?.taskStats?.total || 0)} tasks completed
              </div>
            </div>

            <div>
              <span className="text-muted-foreground">Budget: </span>
              {getBudgetAllocated(viewTarget).toLocaleString()}
            </div>
            <div>
              <span className="text-muted-foreground">Due Date: </span>
              {getDueDate(viewTarget)}
            </div>
            <div>
              <span className="text-muted-foreground">Manager: </span>
              {getManagerName(viewTarget)}
            </div>
            <div>
              <span className="text-muted-foreground">Members: </span>
              {getMemberCount(viewTarget)}
            </div>
          </div>

          {canSeeTasks && (
            <div className="mt-4 border-t border-border pt-4">
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
                  className={buttonCompactClass}
                >
                  {tasksLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>

              {tasksLoading ? (
                <div className="text-sm text-muted-foreground">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="text-sm text-muted-foreground">No tasks found.</div>
              ) : (
                <div className={compactMode ? "space-y-1.5" : "space-y-2"}>
                  {tasks.map((t) => (
                    <div
                      key={t._id}
                      className={`flex items-center justify-between gap-3 ${compactMode ? "p-2.5" : "p-3"} rounded-lg border border-border bg-card`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Assigned: {t?.assignedTo?.name || "Unassigned"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={t.status === "done" ? "default" : "outline"}>{t.status}</Badge>

                        {canUpdateTasks && !isClient && (
                          <Select value={t.status} onValueChange={(v) => updateTaskStatus(t._id, v as TaskStatus)}>
                            <SelectTrigger className={`w-40 ${selectTriggerCompactClass}`}>
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
            <Button type="button" variant="outline" onClick={() => setViewOpen(false)} className={buttonCompactClass}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details</DialogDescription>
          </DialogHeader>

          <div className={dialogFieldSpacing}>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className={selectTriggerCompactClass} />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={descriptionRows}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className={`grid grid-cols-2 ${dialogGridGap}`}>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ProjectStatus)}>
                  <SelectTrigger className={selectTriggerCompactClass}>
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger className={selectTriggerCompactClass}>
                    <SelectValue />
                  </SelectTrigger>
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
              <Input
                type="number"
                value={editBudgetAllocated}
                onChange={(e) => setEditBudgetAllocated(e.target.value)}
                className={selectTriggerCompactClass}
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className={selectTriggerCompactClass}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={savingEdit}
              className={buttonCompactClass}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveEditProject} disabled={savingEdit} className={buttonCompactClass}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-w-lg border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Assign / Change Manager</DialogTitle>
            <DialogDescription>{managerTarget?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Project Manager</Label>
            <Select value={managerPick} onValueChange={setManagerPick}>
              <SelectTrigger className={selectTriggerCompactClass}>
                <SelectValue placeholder="Select a manager" />
              </SelectTrigger>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setManagerOpen(false)}
              disabled={savingManager}
              className={buttonCompactClass}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveManager} disabled={savingManager} className={buttonCompactClass}>
              {savingManager ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-xl border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Assign / Change Members</DialogTitle>
            <DialogDescription>{membersTarget?.name}</DialogDescription>
          </DialogHeader>

          <div className={compactMode ? "space-y-2.5" : "space-y-3"}>
            <Label>Add team member</Label>

            <div className={`grid grid-cols-1 md:grid-cols-3 ${compactMode ? "gap-2.5" : "gap-3"}`}>
              <div className="md:col-span-2">
                <Select value={membersPick} onValueChange={setMembersPick}>
                  <SelectTrigger className={selectTriggerCompactClass}>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
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
                className={buttonCompactClass}
              >
                Add
              </Button>
            </div>

            {selectedMembersObjectsAssign.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedMembersObjectsAssign.map((m) => (
                  <span
                    key={m._id}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-foreground text-sm"
                  >
                    {m.name}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => removeMemberAssign(m._id)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No members selected</div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMembersOpen(false)}
              disabled={savingMembers}
              className={buttonCompactClass}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveMembers} disabled={savingMembers} className={buttonCompactClass}>
              {savingMembers ? "Saving..." : "Save Members"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-lg border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-medium">{deleteTarget?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className={buttonCompactClass}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className={buttonCompactClass}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}