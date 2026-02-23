// backend/routes/project.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const Project = require("../models/Project");

// ---------- helpers ----------
const refId = (val) => {
  if (!val) return null;
  if (typeof val === "string") return String(val);
  if (val._id) return String(val._id);
  return null;
};

const normalizeRole = (role) => {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "admin";
  if (["project-manager", "projectmanager", "project manager", "pm"].includes(r))
    return "project-manager";
  if (["team-member", "teammember", "team member", "member"].includes(r))
    return "team-member";
  if (r === "client") return "client";
  return r;
};

const getUserId = (req) => String(req.user?.id || req.user?._id || "");

const isAdmin = (req) => normalizeRole(req.user?.role) === "admin";
const isPM = (req) => normalizeRole(req.user?.role) === "project-manager";

// ✅ NEW (minimal additions)
const isTeam = (req) => normalizeRole(req.user?.role) === "team-member";
const isClient = (req) => normalizeRole(req.user?.role) === "client";

const isProjectManagerOf = (req, project) =>
  refId(project?.projectManager) === getUserId(req);

const isCreatorOf = (req, project) =>
  refId(project?.createdBy) === getUserId(req);

// ✅ Everyone logged-in can view projects
const canViewProject = (req) => Boolean(getUserId(req));

// ✅ Admin can edit any project
// ✅ PM can edit ONLY if PM is manager or creator (matches your requirement)
const canEditProject = (req, project) => {
  if (isAdmin(req)) return true;
  if (isPM(req)) return isProjectManagerOf(req, project) || isCreatorOf(req, project); // ✅ CHANGED
  return false;
};

// ✅ Admin can delete any project
// ✅ PM can delete ONLY if PM is manager or creator (matches your requirement)
const canDeleteProject = (req, project) => {
  if (isAdmin(req)) return true;
  if (isPM(req)) return isProjectManagerOf(req, project) || isCreatorOf(req, project); // ✅ CHANGED
  return false;
};

// =====================================================
// ✅ GET PROJECTS (FILTERED BY ROLE)
// =====================================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (!canViewProject(req)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const userId = getUserId(req);

    // ✅ NEW: role-based filtering (fixes client seeing other projects)
    let filter = {};

    // Client → only their projects
    if (isClient(req)) {
      filter = { $or: [{ clientId: userId }, { client: userId }] };
    }

    // Team member → projects where they are a member (optional but correct)
    else if (isTeam(req)) {
      filter = { members: userId };
    }

    // PM → projects they manage OR created (optional but correct)
    else if (isPM(req)) {
      filter = { $or: [{ projectManager: userId }, { createdBy: userId }] };
    }

    // Admin → all projects (default filter = {})

    const projects = await Project.find(filter)
      .populate("projectManager", "name role email")
      .populate("members", "name role email")
      .sort({ createdAt: -1 });

    return res.json({ projects });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// ✅ CREATE PROJECT (ADMIN + PROJECT MANAGER)
// =====================================================
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (!isAdmin(req) && !isPM(req)) {
      return res
        .status(403)
        .json({ message: "Only admin or project manager can create projects" });
    }

    const userId = getUserId(req);

    const {
      name,
      description,
      status,
      priority,
      projectManager,
      members,
      budgetAllocated,
      dueDate,
      clientId,
      client,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Project name is required" });
    }

    const chosenManager =
      projectManager && String(projectManager).trim()
        ? projectManager
        : isPM(req)
        ? userId
        : null;

    const project = await Project.create({
      name: String(name).trim(),
      description: description ? String(description) : "",
      status: status || "planning",
      priority: priority || "medium",
      createdBy: userId,
      projectManager: chosenManager || null,
      members: Array.isArray(members) ? members : [],
      budget: { allocated: Number(budgetAllocated) || 0, spent: 0 },
      dueDate: dueDate ? new Date(dueDate) : null,
      progress: 0,
      archived: false,

      // keep your existing client linking (supports both shapes)
      clientId: clientId ? String(clientId) : undefined,
      client: client ? String(client) : undefined,
    });

    const populated = await Project.findById(project._id)
      .populate("projectManager", "name role email")
      .populate("members", "name role email");

    return res.status(201).json({ message: "Project created", project: populated });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// ✅ UPDATE PROJECT (ADMIN + PM scoped)
// =====================================================
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!canEditProject(req, project)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const body = req.body || {};

    if (body.name !== undefined) project.name = String(body.name).trim();
    if (body.description !== undefined)
      project.description = String(body.description || "");
    if (body.status !== undefined) project.status = body.status;
    if (body.priority !== undefined) project.priority = body.priority;
    if (body.dueDate !== undefined)
      project.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    if (body.budgetAllocated !== undefined) {
      project.budget = project.budget || { allocated: 0, spent: 0 };
      project.budget.allocated = Number(body.budgetAllocated) || 0;
    }

    if (body.projectManager !== undefined) {
      project.projectManager = body.projectManager ? body.projectManager : null;
    }

    if (body.members !== undefined) {
      project.members = Array.isArray(body.members) ? body.members : [];
    }

    await project.save();

    const populated = await Project.findById(project._id)
      .populate("projectManager", "name role email")
      .populate("members", "name role email");

    return res.json({ message: "Project updated", project: populated });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// ✅ ARCHIVE PROJECT (ADMIN + PM scoped)
// =====================================================
router.patch("/:id/archive", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!canEditProject(req, project)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    project.archived = Boolean(req.body.archived);
    await project.save();

    const populated = await Project.findById(project._id)
      .populate("projectManager", "name role email")
      .populate("members", "name role email");

    return res.json({
      message: project.archived ? "Project archived" : "Project unarchived",
      project: populated,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// ✅ DELETE PROJECT (ADMIN + PM scoped)
// =====================================================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!canDeleteProject(req, project)) {
      return res.status(403).json({ message: "Not allowed to delete this project" });
    }

    await Project.deleteOne({ _id: project._id });
    return res.json({ message: "Project deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
