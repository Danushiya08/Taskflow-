const path = require("path");
const fs = require("fs");

const Document = require("../models/Document");
const ProjectMember = require("../models/ProjectMember");
const { canUpload, canManage } = require("../middleware/docAccessMiddleware");
const { logActivity } = require("../utils/activityHelper");
const { createNotificationsForUsers } = require("../utils/notificationHelper");

// ---------- helpers ----------
const getUserId = (user) => String(user?._id || "");

const getUserName = (user) =>
  user?.name || user?.fullName || user?.username || "A user";

const getProjectMemberUserIds = async (projectId, excludeUserId = null) => {
  const members = await ProjectMember.find({ project: projectId }).select("user");

  return [
    ...new Set(
      members
        .map((m) => String(m.user))
        .filter(Boolean)
        .filter((id) => id !== String(excludeUserId || ""))
    ),
  ];
};

const notifyUsers = async ({
  userIds = [],
  type,
  title,
  message,
  relatedProject = null,
  relatedTask = null,
}) => {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) return;

    await createNotificationsForUsers({
      userIds,
      type,
      title,
      message,
      relatedProject,
      relatedTask,
    });
  } catch (err) {
    console.error("Notification warning:", err.message);
  }
};

const addActivity = async ({
  user,
  action,
  entityType,
  entityId = null,
  project = null,
  task = null,
  description,
  metadata = {},
}) => {
  try {
    await logActivity({
      user,
      action,
      entityType,
      entityId,
      project,
      task,
      description,
      metadata,
    });
  } catch (err) {
    console.error("Activity log warning:", err.message);
  }
};

// POST /api/projects/:projectId/documents
// Upload new document OR upload new version if same title exists
exports.uploadDocument = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      title,
      description = "",
      visibility = "internal",
      status = "draft",
      changeNote = "",
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    if (!canUpload(req.projectRole)) {
      return res.status(403).json({ message: "You cannot upload documents" });
    }

    const cleanTitle = String(title).trim();
    const fileUrl = `/uploads/${req.file.filename}`;
    const actorId = getUserId(req.user);
    const actorName = getUserName(req.user);

    let doc = await Document.findOne({
      project: projectId,
      title: cleanTitle,
      isDeleted: false,
    });

    // Create new document
    if (!doc) {
      doc = await Document.create({
        project: projectId,
        title: cleanTitle,
        description,
        visibility,
        status,
        sharedWith: [],
        versions: [
          {
            version: 1,
            fileUrl,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedBy: req.user._id,
            changeNote,
          },
        ],
        currentVersion: 1,
      });

      await addActivity({
        user: actorId,
        action: "document_uploaded",
        entityType: "document",
        entityId: doc._id,
        project: projectId,
        description: `${actorName} uploaded document "${cleanTitle}" (v1)`,
        metadata: {
          title: cleanTitle,
          version: 1,
          visibility,
          status,
        },
      });

      const recipientIds = await getProjectMemberUserIds(projectId, actorId);

      await notifyUsers({
        userIds: recipientIds,
        type: "document",
        title: "New document uploaded",
        message: `${actorName} uploaded "${cleanTitle}"`,
        relatedProject: projectId,
      });

      const populatedDoc = await Document.findById(doc._id)
        .populate("sharedWith", "name email role")
        .populate("versions.uploadedBy", "name email role");

      return res.status(201).json({
        message: "Document uploaded (v1)",
        doc: populatedDoc,
      });
    }

    // Add new version
    const nextVersion = (doc.currentVersion || 1) + 1;

    doc.versions.push({
      version: nextVersion,
      fileUrl,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      changeNote,
    });

    doc.currentVersion = nextVersion;

    if (typeof description === "string") doc.description = description;
    if (visibility) doc.visibility = visibility;
    if (status) doc.status = status;

    await doc.save();

    await addActivity({
      user: actorId,
      action: "document_version_uploaded",
      entityType: "document",
      entityId: doc._id,
      project: projectId,
      description: `${actorName} uploaded a new version (v${nextVersion}) for "${doc.title}"`,
      metadata: {
        title: doc.title,
        version: nextVersion,
        visibility: doc.visibility,
        status: doc.status,
      },
    });

    const recipientIds = await getProjectMemberUserIds(projectId, actorId);

    await notifyUsers({
      userIds: recipientIds,
      type: "document",
      title: "Document updated",
      message: `${actorName} uploaded a new version of "${doc.title}"`,
      relatedProject: projectId,
    });

    const updatedDoc = await Document.findById(doc._id)
      .populate("sharedWith", "name email role")
      .populate("versions.uploadedBy", "name email role");

    return res.status(200).json({
      message: `New version uploaded (v${nextVersion})`,
      doc: updatedDoc,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Upload failed",
      error: e.message,
    });
  }
};

// GET /api/projects/:projectId/documents?search=&visibility=&status=
exports.listDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { search = "", visibility, status } = req.query;

    const q = {
      project: projectId,
      isDeleted: false,
      ...(search
        ? { title: { $regex: String(search).trim(), $options: "i" } }
        : {}),
      ...(visibility ? { visibility } : {}),
      ...(status ? { status } : {}),
    };

    if (req.projectRole === "client") {
      q.visibility = "client";
    }

    const docs = await Document.find(q)
      .sort({ updatedAt: -1 })
      .populate("sharedWith", "name email role")
      .populate("versions.uploadedBy", "name email role");

    return res.json({ docs });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to load documents",
      error: e.message,
    });
  }
};

// OPTIONAL: GET /api/documents
exports.listAllDocuments = async (req, res) => {
  try {
    if (String(req.user?.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({ message: "Only admin can view all documents" });
    }

    const { search = "", visibility, status, projectId } = req.query;

    const q = {
      isDeleted: false,
      ...(projectId ? { project: projectId } : {}),
      ...(search
        ? { title: { $regex: String(search).trim(), $options: "i" } }
        : {}),
      ...(visibility ? { visibility } : {}),
      ...(status ? { status } : {}),
    };

    const docs = await Document.find(q)
      .sort({ updatedAt: -1 })
      .populate("project", "name")
      .populate("sharedWith", "name email role")
      .populate("versions.uploadedBy", "name email role");

    return res.json({ docs });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to load all documents",
      error: e.message,
    });
  }
};

// GET /api/documents/:id/versions
exports.getVersions = async (req, res) => {
  try {
    const doc = await Document.findById(req.doc._id).populate(
      "versions.uploadedBy",
      "name email role"
    );

    if (!doc || doc.isDeleted) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.json({
      title: doc.title,
      currentVersion: doc.currentVersion,
      versions: doc.versions,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Failed to load versions",
      error: e.message,
    });
  }
};

// POST /api/documents/:id/restore/:version
exports.restoreVersion = async (req, res) => {
  try {
    const doc = req.doc;

    if (!canManage(req.projectRole)) {
      return res.status(403).json({
        message: "Only Admin/PM can restore versions",
      });
    }

    const version = Number(req.params.version);
    const exists = doc.versions.find((v) => v.version === version);

    if (!exists) {
      return res.status(404).json({ message: "Version not found" });
    }

    doc.currentVersion = version;
    await doc.save();

    await addActivity({
      user: getUserId(req.user),
      action: "document_restored",
      entityType: "document",
      entityId: doc._id,
      project: doc.project,
      description: `${getUserName(req.user)} restored "${doc.title}" to v${version}`,
      metadata: {
        title: doc.title,
        version,
      },
    });

    const recipientIds = await getProjectMemberUserIds(
      doc.project,
      getUserId(req.user)
    );

    await notifyUsers({
      userIds: recipientIds,
      type: "document",
      title: "Document version restored",
      message: `${getUserName(req.user)} restored "${doc.title}" to v${version}`,
      relatedProject: doc.project,
    });

    const updatedDoc = await Document.findById(doc._id)
      .populate("sharedWith", "name email role")
      .populate("versions.uploadedBy", "name email role");

    return res.json({
      message: `Restored to v${version}`,
      doc: updatedDoc,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Restore failed",
      error: e.message,
    });
  }
};

// POST /api/documents/:id/share
exports.shareDocument = async (req, res) => {
  try {
    const doc = req.doc;

    if (!canManage(req.projectRole)) {
      return res.status(403).json({
        message: "Only Admin/PM can share documents",
      });
    }

    const { userIds = [] } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "userIds are required" });
    }

    const members = await ProjectMember.find({
      project: doc.project,
      user: { $in: userIds },
    }).select("user");

    const allowedUserIds = [...new Set(members.map((m) => String(m.user)))];

    doc.sharedWith = Array.from(
      new Set([...(doc.sharedWith || []).map(String), ...allowedUserIds])
    );

    await doc.save();

    await addActivity({
      user: getUserId(req.user),
      action: "document_shared",
      entityType: "document",
      entityId: doc._id,
      project: doc.project,
      description: `${getUserName(req.user)} shared "${doc.title}" with ${allowedUserIds.length} user(s)`,
      metadata: {
        title: doc.title,
        sharedWithCount: allowedUserIds.length,
        sharedWith: allowedUserIds,
      },
    });

    await notifyUsers({
      userIds: allowedUserIds,
      type: "document",
      title: "Document shared with you",
      message: `${getUserName(req.user)} shared "${doc.title}" with you`,
      relatedProject: doc.project,
    });

    const updatedDoc = await Document.findById(doc._id)
      .populate("sharedWith", "name email role")
      .populate("versions.uploadedBy", "name email role");

    return res.json({
      message: "Document shared",
      doc: updatedDoc,
    });
  } catch (e) {
    return res.status(500).json({
      message: "Share failed",
      error: e.message,
    });
  }
};

// GET /api/documents/:id/download
exports.downloadCurrent = async (req, res) => {
  try {
    const doc = req.doc;
    const current = doc.versions.find((v) => v.version === doc.currentVersion);

    if (!current) {
      return res.status(404).json({ message: "Current file missing" });
    }

    const relativePath = current.fileUrl.replace(/^\//, "");
    const filePath = path.join(__dirname, "..", relativePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    return res.download(filePath, current.fileName);
  } catch (e) {
    return res.status(500).json({
      message: "Download failed",
      error: e.message,
    });
  }
};

// DELETE /api/documents/:id
exports.deleteDocument = async (req, res) => {
  try {
    const doc = req.doc;

    if (!canManage(req.projectRole)) {
      return res.status(403).json({
        message: "Only Admin/PM can delete documents",
      });
    }

    doc.isDeleted = true;
    await doc.save();

    await addActivity({
      user: getUserId(req.user),
      action: "document_deleted",
      entityType: "document",
      entityId: doc._id,
      project: doc.project,
      description: `${getUserName(req.user)} deleted document "${doc.title}"`,
      metadata: {
        title: doc.title,
      },
    });

    const recipientIds = await getProjectMemberUserIds(
      doc.project,
      getUserId(req.user)
    );

    await notifyUsers({
      userIds: recipientIds,
      type: "document",
      title: "Document deleted",
      message: `${getUserName(req.user)} deleted "${doc.title}"`,
      relatedProject: doc.project,
    });

    return res.json({ message: "Document deleted successfully" });
  } catch (e) {
    return res.status(500).json({
      message: "Delete failed",
      error: e.message,
    });
  }
};