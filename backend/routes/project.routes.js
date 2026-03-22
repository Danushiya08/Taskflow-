const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const Project = require("../models/Project");
const ProjectMember = require("../models/ProjectMember");

const {
  createNotificationsForUsers,
  notifyByRoles,
} = require("../utils/notificationHelper");

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
  if (["project-manager", "projectmanager", "project manager", "pm"].includes(r)) {
    return "project-manager";
  }
  if (["team-member", "teammember", "team member", "member"].includes(r)) {
    return "team-member";
  }
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

const canViewProject = (req) => Boolean(getUserId(req));

const canEditProject = (req, project) => {
  if (isAdmin(req)) return true;
  if (isPM(req)) return isProjectManagerOf(req, project) || isCreatorOf(req, project);
  return false;
};

const canDeleteProject = (req, project) => {
  if (isAdmin(req)) return true;
  if (isPM(req)) return isProjectManagerOf(req, project) || isCreatorOf(req, project);
  return false;
};

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
  if (creatorId && creatorId !== pmId) {
    desired.push({ user: creatorId, roleInProject: "project-manager" });
  }

  for (const mid of memberIds) {
    desired.push({ user: mid, roleInProject: "team-member" });
  }

  if (clientId) {
    desired.push({ user: clientId, roleInProject: "client" });
  }

  await ProjectMember.deleteMany({ project: projectId });

  if (desired.length) {
    await ProjectMember.insertMany(
      desired.map((d) => ({
        project: projectId,
        user: d.user,
        roleInProject: d.roleInProject,
      })),
      { ordered: false }
    ).catch(() => {});
  }
};

// =====================================================
// GET PROJECTS
// =====================================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (!canViewProject(req)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const userId = getUserId(req);

    if (isAdmin(req)) {
      const projects = await Project.find({})
        .populate("projectManager", "name role email")
        .populate("members", "name role email")
        .sort({ createdAt: -1 });

      return res.json({ projects });
    }

    if (isClient(req)) {
      const projects = await Project.find({ client: userId })
        .populate("projectManager", "name role email")
        .populate("members", "name role email")
        .sort({ createdAt: -1 });

      return res.json({ projects });
    }

    const memberships = await ProjectMember.find({ user: userId }).select("project roleInProject");
    const projectIds = memberships.map((m) => m.project);

    let filter = { _id: { $in: projectIds } };

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
    console.error("Get projects error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// CREATE PROJECT
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
      client: chosenClient,
    });

    await upsertMembersForProject(project);

    // Notify assigned project manager
    if (project.projectManager && String(project.projectManager) !== String(userId)) {
      await createNotificationsForUsers({
        userIds: [project.projectManager],
        type: "project_created",
        title: "New project assigned",
        message: `You have been assigned as project manager for "${project.name}"`,
        relatedProject: project._id,
        relatedTask: null,
      });
    }

    // Notify team members
    if (Array.isArray(project.members) && project.members.length > 0) {
      const memberIds = project.members
        .map((m) => String(m))
        .filter((memberId) => memberId !== String(userId));

      if (memberIds.length) {
        await createNotificationsForUsers({
          userIds: memberIds,
          type: "project_created",
          title: "Added to new project",
          message: `You have been added to the project "${project.name}"`,
          relatedProject: project._id,
          relatedTask: null,
        });
      }
    }

    // Notify client
    if (project.client && String(project.client) !== String(userId)) {
      await createNotificationsForUsers({
        userIds: [project.client],
        type: "project_created",
        title: "Project created",
        message: `Your project "${project.name}" has been created.`,
        relatedProject: project._id,
        relatedTask: null,
      });
    }

    // Notify admin / PM stakeholders except actor
    await notifyByRoles({
      projectId: project._id,
      roles: ["admin", "project-manager"],
      type: "activity_added",
      title: "Project created",
      message: `Project "${project.name}" was created.`,
      relatedProject: project._id,
      relatedTask: null,
      excludeUserIds: [userId],
    });

    const populated = await Project.findById(project._id)
      .populate("projectManager", "name role email")
      .populate("members", "name role email");

    return res.status(201).json({ message: "Project created", project: populated });
  } catch (err) {
    console.error("Create project error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// UPDATE PROJECT
// =====================================================
// =====================================================
// PATCH PROJECT (needed for frontend api.patch)
// =====================================================
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!canEditProject(req, project)) {
      return res.status(403).json({ message: "Not allowed to edit this project" });
    }

    const {
      name,
      description,
      status,
      priority,
      projectManager,
      members,
      budgetAllocated,
      dueDate,
      client,
    } = req.body;

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;
    if (priority !== undefined) project.priority = priority;
    if (projectManager !== undefined) project.projectManager = projectManager;
    if (members !== undefined) project.members = members;

    if (budgetAllocated !== undefined) {
      project.budget.allocated = Number(budgetAllocated) || 0;
    }

    if (dueDate !== undefined) {
      project.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (client !== undefined) {
      project.client = client;
    }

    await project.save();

    await upsertMembersForProject(project);

    const populated = await Project.findById(project._id)
      .populate("projectManager", "name role email")
      .populate("members", "name role email");

    return res.json({
      message: "Project patched",
      project: populated,
    });

  } catch (err) {
    console.error("Patch project error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});
// =====================================================
// DELETE PROJECT
// =====================================================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!canDeleteProject(req, project)) {
      return res.status(403).json({ message: "Not allowed to delete this project" });
    }

    const projectName = project.name;
    const projectId = project._id;
    const actorId = getUserId(req);

    await notifyByRoles({
      projectId,
      roles: ["admin", "project-manager"],
      type: "activity_added",
      title: "Project deleted",
      message: `Project "${projectName}" was deleted.`,
      relatedProject: projectId,
      relatedTask: null,
      excludeUserIds: [actorId],
    });

    await ProjectMember.deleteMany({ project: project._id }).catch(() => {});
    await Project.deleteOne({ _id: project._id });

    return res.json({ message: "Project deleted" });
  } catch (err) {
    console.error("Delete project error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;