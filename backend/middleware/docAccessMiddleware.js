const ProjectMember = require("../models/ProjectMember");
const Document = require("../models/Document");

const normalizeRole = (role) => String(role || "").trim().toLowerCase();

async function getProjectRole(user, projectId) {
  if (!user) return null;

  const sysRole = normalizeRole(user.role);
  if (sysRole === "admin") return "admin";

  const membership = await ProjectMember.findOne({ project: projectId, user: user._id });
  const r = normalizeRole(membership?.roleInProject);
  return r || null;
}

function canUpload(projectRole) {
  return ["admin", "project-manager", "team-member"].includes(projectRole);
}
function canManage(projectRole) {
  return ["admin", "project-manager"].includes(projectRole);
}

function canClientSee(doc, projectRole) {
  if (["admin", "project-manager", "team-member"].includes(projectRole)) return true;
  return doc.visibility === "client";
}

async function requireProjectAccess(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectRole = await getProjectRole(req.user, projectId);

    if (!projectRole) return res.status(403).json({ message: "No access to this project" });

    req.projectRole = projectRole;
    next();
  } catch (e) {
    return res.status(500).json({ message: "Access check failed" });
  }
}

async function requireDocumentAccess(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: "Document not found" });

    const projectRole = await getProjectRole(req.user, doc.project);
    if (!projectRole) return res.status(403).json({ message: "No access to this project" });

    if (!canClientSee(doc, projectRole)) {
      return res.status(403).json({ message: "Client cannot view internal documents" });
    }

    req.projectRole = projectRole;
    req.doc = doc;
    next();
  } catch (e) {
    return res.status(500).json({ message: "Document access check failed" });
  }
}

module.exports = { requireProjectAccess, requireDocumentAccess, canUpload, canManage, getProjectRole };