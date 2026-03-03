// backend/routes/project.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const Project = require("../models/Project");

// ✅ use membership table (ProjectMember)
const ProjectMember = require("../models/ProjectMember");

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
const isTeam = (req) => normalizeRole(req.user?.role) === "team-member";
const isClient = (req) => normalizeRole(req.user?.role) === "client";

const isProjectManagerOf = (req, project) =>
  refId(project?.projectManager) === getUserId(req);

const isCreatorOf = (req, project) =>
  refId(project?.createdBy) === getUserId(req);

// ✅ Everyone logged-in can view projects
const canViewProject = (req) => Boolean(getUserId(req));

// ✅ Admin can edit any project
// ✅ PM can edit ONLY if PM is manager or creator
const canEditProject = (req, project) => {
  if (isAdmin(req)) return true;
  if (isPM(req)) return isProjectManagerOf(req, project) || isCreatorOf(req, project);
  return false;
};

// ✅ Admin can delete any project
// ✅ PM can delete ONLY if PM is manager or creator
const canDeleteProject = (req, project) => {
  if (isAdmin(req)) return true;
  if (isPM(req)) return isProjectManagerOf(req, project) || isCreatorOf(req, project);
  return false;
};

// ✅ NEW: sync ProjectMember docs (minimal + safe)
const uniqIds = (arr) =>
  [...new Set((Array.isArray(arr) ? arr : []).filter(Boolean).map((x) => String(x)))];

const upsertMembersForProject = async (project) => {
  const projectId = project._id;

  const pmId = project.projectManager ? String(project.projectManager) : null;
  const creatorId = project.createdBy ? String(project.createdBy) : null;
  const memberIds = uniqIds(project.members || []);
  const clientId = project.client ? String(project.client) : null;

  const desired = [];

  if (pmId) desired.push({ user: pmId, roleInProject: "project-manager" });
  if (creatorId && creatorId !== pmId)
    desired.push({ user: creatorId, roleInProject: "project-manager" });

  for (const mid of memberIds) desired.push({ user: mid, roleInProject: "team-member" });
  if (clientId) desired.push({ user: clientId, roleInProject: "client" });

  // keep it small: remove old & recreate (simple + consistent)
  await ProjectMember.deleteMany({ project: projectId });
  if (desired.length) {
    await ProjectMember.insertMany(
      desired.map((d) => ({ project: projectId, user: d.user, roleInProject: d.roleInProject })),
      { ordered: false }
    ).catch(() => {});
  }
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

    // ✅ Admin → all projects
    if (isAdmin(req)) {
      const projects = await Project.find({})
        .populate("projectManager", "name role email")
        .populate("members", "name role email")
        .sort({ createdAt: -1 });

      return res.json({ projects });
    }

    // ✅ FIX (Client): do NOT depend on ProjectMember only
    // Client projects come from Project.client field in your schema
    if (isClient(req)) {
      const projects = await Project.find({ client: userId })
        .populate("projectManager", "name role email")
        .populate("members", "name role email")
        .sort({ createdAt: -1 });

      return res.json({ projects });
    }

    // ✅ PM / Team → fetch project ids from ProjectMember table
    const memberships = await ProjectMember.find({ user: userId }).select("project roleInProject");
    const projectIds = memberships.map((m) => m.project);

    let filter = { _id: { $in: projectIds } };

    // ✅ Optional: PM can also see projects they manage or created (even if membership missing)
    if (isPM(req)) {
      filter = {
        $or: [
          { _id: { $in: projectIds } },
          { projectManager: userId },
          { createdBy: userId },
        ],
      };
    }

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

      // accept both, but your schema is ONLY `client`
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

    // ✅ FIX: map to schema field `client`
    const chosenClient =
      (client && String(client).trim()) || (clientId && String(clientId).trim()) || null;

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

      // ✅ schema-supported field
      client: chosenClient,
    });

    // ✅ NEW: keep ProjectMember table in sync
    await upsertMembersForProject(project);

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

    // ✅ NEW: allow updating client properly (schema is `client`)
    if (body.client !== undefined || body.clientId !== undefined) {
      const chosenClient =
        (body.client && String(body.client).trim()) ||
        (body.clientId && String(body.clientId).trim()) ||
        null;
      project.client = chosenClient;
    }

    await project.save();

    // ✅ NEW: keep ProjectMember table in sync
    await upsertMembersForProject(project);

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

    await ProjectMember.deleteMany({ project: project._id }).catch(() => {});
    await Project.deleteOne({ _id: project._id });

    return res.json({ message: "Project deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;