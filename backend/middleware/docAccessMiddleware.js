const ProjectMember = require("../models/ProjectMember");
const Project = require("../models/Project");
const Document = require("../models/Document");

const normalizeRole = (role) => {
  const r = String(role || "").trim().toLowerCase();

  if (r === "admin") return "admin";
  if (["project-manager", "project manager", "projectmanager", "pm"].includes(r)) {
    return "project-manager";
  }
  if (["team-member", "team member", "teammember", "member"].includes(r)) {
    return "team-member";
  }
  if (r === "client") return "client";

  return r;
};

async function getProjectRole(user, projectId) {
  if (!user) return null;

  const userId = String(user._id || user.id || "");
  const sysRole = normalizeRole(user.role);

  if (sysRole === "admin") return "admin";
  if (!userId || !projectId) return null;

  // 1. Check ProjectMember table first
  const membership = await ProjectMember.findOne({
    project: projectId,
    user: userId,
  });

  const membershipRole = normalizeRole(membership?.roleInProject);
  if (membershipRole) return membershipRole;

  // 2. Fallback to Project model
  const project = await Project.findById(projectId).select(
    "createdBy projectManager client members"
  );

  if (!project) return null;

  if (String(project.projectManager || "") === userId) {
    return "project-manager";
  }

  if (
    Array.isArray(project.members) &&
    project.members.map((id) => String(id)).includes(userId)
  ) {
    return "team-member";
  }

  if (String(project.client || "") === userId) {
    return "client";
  }

  if (String(project.createdBy || "") === userId) {
    return "project-manager";
  }

  return null;
}

function canUpload(projectRole) {
  const role = normalizeRole(projectRole);
  return ["admin", "project-manager", "team-member"].includes(role);
}

function canManage(projectRole) {
  const role = normalizeRole(projectRole);
  return ["admin", "project-manager"].includes(role);
}

function canRestore(projectRole) {
  const role = normalizeRole(projectRole);
  return ["admin", "project-manager"].includes(role);
}

function canClientSee(doc, projectRole) {
  const role = normalizeRole(projectRole);

  if (["admin", "project-manager", "team-member"].includes(role)) return true;
  return doc.visibility === "client";
}

async function requireProjectAccess(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectRole = await getProjectRole(req.user, projectId);

    if (!projectRole) {
      return res.status(403).json({ message: "No access to this project" });
    }

    req.projectRole = normalizeRole(projectRole);
    next();
  } catch (error) {
    console.error("requireProjectAccess error:", error);
    return res.status(500).json({ message: "Access check failed" });
  }
}

async function requireDocumentAccess(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) {
      return res.status(404).json({ message: "Document not found" });
    }

    const projectRole = await getProjectRole(req.user, doc.project);
    if (!projectRole) {
      return res.status(403).json({ message: "No access to this project" });
    }

    if (!canClientSee(doc, projectRole)) {
      return res.status(403).json({ message: "Client cannot view internal documents" });
    }

    req.projectRole = normalizeRole(projectRole);
    req.doc = doc;
    next();
  } catch (error) {
    console.error("requireDocumentAccess error:", error);
    return res.status(500).json({ message: "Document access check failed" });
  }
}

function requireUploadPermission(req, res, next) {
  if (!canUpload(req.projectRole)) {
    return res.status(403).json({ message: "You do not have permission to upload documents" });
  }
  next();
}

function requireManagePermission(req, res, next) {
  if (!canManage(req.projectRole)) {
    return res.status(403).json({ message: "You do not have permission to manage documents" });
  }
  next();
}

function requireRestorePermission(req, res, next) {
  if (!canRestore(req.projectRole)) {
    return res.status(403).json({ message: "Only Admin or Project Manager can restore document versions" });
  }
  next();
}

module.exports = {
  requireProjectAccess,
  requireDocumentAccess,
  requireUploadPermission,
  requireManagePermission,
  requireRestorePermission,
  canUpload,
  canManage,
  canRestore,
  canClientSee,
  getProjectRole,
};