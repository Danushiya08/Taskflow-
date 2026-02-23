// backend/routes/task.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const Project = require("../models/Project");
const Task = require("../models/Task");

// ---------- helpers ----------
const normalizeRole = (role) => {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "admin";
  if (["project-manager", "projectmanager", "project manager", "pm"].includes(r)) return "project-manager";
  if (["team-member", "teammember", "team member", "member"].includes(r)) return "team-member";
  if (r === "client") return "client";
  return r;
};

const role = (req) => normalizeRole(req.user?.role);
const isAdmin = (req) => role(req) === "admin";
const isPM = (req) => role(req) === "project-manager";
const isTeam = (req) => role(req) === "team-member";
const isClient = (req) => role(req) === "client";

const id = (v) => (v?._id ? String(v._id) : v ? String(v) : null);

const userIdFromReq = (req) => String(req.user?.id || req.user?._id || "");

// =====================================================
// ✅ PERMISSION RULE (PM FIX)
// =====================================================
const canManageTasksForProject = (req, project) => {
  if (isAdmin(req)) return true;

  if (isPM(req)) {
    const userId = id(req.user?.id || req.user?._id);

    const pmId =
      id(project?.projectManager) ||
      id(project?.projectManagerId) ||
      id(project?.manager) ||
      id(project?.managerId) ||
      id(project?.projectManagerUser) ||
      id(project?.projectManager?._id);

    const creatorId =
      id(project?.createdBy) ||
      id(project?.owner) ||
      id(project?.ownerId) ||
      id(project?.createdBy?._id);

    return pmId === userId || creatorId === userId;
  }

  return false;
};

// =====================================================
// ✅ CLIENT CAN VIEW THIS PROJECT?
// (prevents client from opening ANY projectId tasks)
// =====================================================
const clientCanViewProject = (req, project) => {
  if (!isClient(req)) return false;
  const cid = userIdFromReq(req);

  // ✅ FIX: Project schema should use "client" as ObjectId ref User
  const projectClientId = id(project?.client) || id(project?.client?._id);

  return projectClientId === cid;
};

// =====================================================
// ✅ RECALCULATE PROJECT PROGRESS
// =====================================================
const recalcProjectProgress = async (projectId) => {
  const total = await Task.countDocuments({ projectId });
  const done = await Task.countDocuments({ projectId, status: "done" });

  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  await Project.findByIdAndUpdate(projectId, { progress });

  return { total, done, progress };
};

// =====================================================
// ✅ CLIENT: GET ALL MY TASKS (across all my projects)
// URL: GET /api/tasks/client/tasks
// Optional: ?projectId=xxxx to filter one project
// IMPORTANT: must be above "/:projectId/tasks"
// =====================================================
router.get("/client/tasks", authMiddleware, async (req, res) => {
  try {
    if (!isClient(req)) return res.status(403).json({ message: "Not allowed" });

    const clientId = userIdFromReq(req);
    if (!clientId) return res.status(401).json({ message: "Unauthorized" });

    // ✅ FIX: only use "client" field
    const clientProjects = await Project.find({ client: clientId }).select("_id");
    const projectIds = clientProjects.map((p) => p._id);

    if (projectIds.length === 0) {
      return res.json({ tasks: [], summary: { total: 0, done: 0, progress: 0 } });
    }

    const { projectId } = req.query;

    // ✅ if projectId provided, ensure it belongs to this client
    if (projectId && !projectIds.some((x) => String(x) === String(projectId))) {
      return res.status(403).json({ message: "Not allowed for this project" });
    }

    const query = { projectId: projectId ? projectId : { $in: projectIds } };

    const tasks = await Task.find(query)
      .populate("assignedTo", "name email role")
      .sort({ createdAt: -1 });

    const total = tasks.length;
    const done = tasks.filter((t) => String(t.status) === "done").length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    return res.json({ tasks, summary: { total, done, progress } });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// ✅ GET TASKS (ALL ROLES SUPPORTED)
// =====================================================
const getProjectTasksHandler = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // ✅ client must only access own projects
    if (isClient(req) && !clientCanViewProject(req, project)) {
      return res.status(403).json({ message: "Not allowed for this project" });
    }

    let query = { projectId: project._id };

    // Team → only assigned tasks
    if (isTeam(req)) {
      query.assignedTo = req.user.id || req.user?._id;
    }

    const tasks = await Task.find(query)
      .populate("assignedTo", "name email role")
      .sort({ createdAt: -1 });

    const summary = await recalcProjectProgress(project._id);

    return res.json({ tasks, summary });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =====================================================
// ✅ CREATE TASK (ADMIN + PM)
// Adds category support for Reports
// =====================================================
const createProjectTaskHandler = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // client/team cannot create tasks
    if (!canManageTasksForProject(req, project)) {
      return res.status(403).json({ message: "You are not allowed to create tasks for this project" });
    }

    const { title, description, status, priority, dueDate, assignedTo, category } = req.body;

    if (!title?.trim()) return res.status(400).json({ message: "Task title is required" });

    const task = await Task.create({
      projectId: project._id,
      title: title.trim(),
      description: description || "",
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedTo: assignedTo || null,

      category: category || "Development",

      createdBy: req.user.id || req.user?._id,
    });

    const populated = await Task.findById(task._id).populate("assignedTo", "name email role");
    const summary = await recalcProjectProgress(project._id);

    return res.status(201).json({ message: "Task created", task: populated, summary });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =====================================================
// ROUTES (supports BOTH mount styles)
// =====================================================
router.get("/projects/:projectId/tasks", authMiddleware, getProjectTasksHandler);
router.post("/projects/:projectId/tasks", authMiddleware, createProjectTaskHandler);

router.get("/:projectId/tasks", authMiddleware, getProjectTasksHandler);
router.post("/:projectId/tasks", authMiddleware, createProjectTaskHandler);

// =====================================================
// UPDATE TASK
// - Team members can update ONLY status for tasks assigned to them
// - Admin/PM can update anything
// - Client cannot update
// =====================================================
router.patch("/tasks/:id", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const project = await Project.findById(task.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // client cannot update
    if (isClient(req)) return res.status(403).json({ message: "Not allowed" });

    // team member: only if assigned + only status update
    if (isTeam(req)) {
      const myId = userIdFromReq(req);
      if (String(task.assignedTo || "") !== myId) {
        return res.status(403).json({ message: "Not allowed" });
      }

      const allowedTeamFields = ["status"];
      for (const k of Object.keys(req.body || {})) {
        if (!allowedTeamFields.includes(k)) {
          return res.status(403).json({ message: "Team members can only update task status" });
        }
      }
    } else {
      // admin/pm must have manage permission
      if (!canManageTasksForProject(req, project)) return res.status(403).json({ message: "Not allowed" });
    }

    const allowedFields = ["title", "description", "status", "priority", "dueDate", "assignedTo", "category"];
    for (const k of allowedFields) {
      if (req.body[k] !== undefined) task[k] = req.body[k];
    }

    await task.save();

    const populated = await Task.findById(task._id).populate("assignedTo", "name email role");
    const summary = await recalcProjectProgress(project._id);

    return res.json({ message: "Task updated", task: populated, summary });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// DELETE TASK (ADMIN + PM ONLY)
// =====================================================
router.delete("/tasks/:id", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const project = await Project.findById(task.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // team/client cannot delete
    if (isTeam(req) || isClient(req)) return res.status(403).json({ message: "Not allowed" });

    if (!canManageTasksForProject(req, project)) return res.status(403).json({ message: "Not allowed" });

    await Task.deleteOne({ _id: task._id });
    const summary = await recalcProjectProgress(project._id);

    return res.json({ message: "Task deleted", summary });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;

