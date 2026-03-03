const path = require("path");
const Document = require("../models/Document");
const ProjectMember = require("../models/ProjectMember");
const { canUpload, canManage } = require("../middleware/docAccessMiddleware");

// POST /api/projects/:projectId/documents  (upload new doc OR new version)
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

    if (!req.file) return res.status(400).json({ message: "File is required" });
    if (!title) return res.status(400).json({ message: "Title is required" });

    if (!canUpload(req.projectRole)) {
      return res.status(403).json({ message: "You cannot upload documents" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    let doc = await Document.findOne({ project: projectId, title, isDeleted: false });

    // Create new doc
    if (!doc) {
      doc = await Document.create({
        project: projectId,
        title,
        description,
        visibility,
        status,
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

      return res.status(201).json({ message: "Document uploaded (v1)", doc });
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

    // Keep latest metadata
    if (typeof description === "string") doc.description = description;
    if (visibility) doc.visibility = visibility;
    if (status) doc.status = status;

    await doc.save();
    return res.status(200).json({ message: `New version uploaded (v${nextVersion})`, doc });
  } catch (e) {
    return res.status(500).json({ message: "Upload failed", error: e.message });
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
      ...(search ? { title: { $regex: search, $options: "i" } } : {}),
      ...(visibility ? { visibility } : {}),
      ...(status ? { status } : {}),
    };

    // client only sees client-visible docs
    if (req.projectRole === "client") q.visibility = "client";

    const docs = await Document.find(q)
      .sort({ updatedAt: -1 })
      .populate("versions.uploadedBy", "name email role");

    return res.json({ docs });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load documents" });
  }
};

// GET /api/documents/:id/versions
exports.getVersions = async (req, res) => {
  const doc = req.doc;
  return res.json({ title: doc.title, currentVersion: doc.currentVersion, versions: doc.versions });
};

// POST /api/documents/:id/restore/:version
exports.restoreVersion = async (req, res) => {
  try {
    const doc = req.doc;
    if (!canManage(req.projectRole)) {
      return res.status(403).json({ message: "Only Admin/PM can restore versions" });
    }

    const version = Number(req.params.version);
    const exists = doc.versions.find((v) => v.version === version);
    if (!exists) return res.status(404).json({ message: "Version not found" });

    doc.currentVersion = version;
    await doc.save();

    return res.json({ message: `Restored to v${version}`, doc });
  } catch (e) {
    return res.status(500).json({ message: "Restore failed" });
  }
};

// POST /api/documents/:id/share
exports.shareDocument = async (req, res) => {
  try {
    const doc = req.doc;
    if (!canManage(req.projectRole)) {
      return res.status(403).json({ message: "Only Admin/PM can share documents" });
    }

    const { userIds = [] } = req.body;

    const members = await ProjectMember.find({
      project: doc.project,
      user: { $in: userIds },
    }).select("user");

    const allowedUserIds = members.map((m) => String(m.user));
    doc.sharedWith = Array.from(new Set([...(doc.sharedWith || []).map(String), ...allowedUserIds]));

    await doc.save();
    return res.json({ message: "Document shared", sharedWith: doc.sharedWith });
  } catch (e) {
    return res.status(500).json({ message: "Share failed" });
  }
};

// GET /api/documents/:id/download
exports.downloadCurrent = async (req, res) => {
  try {
    const doc = req.doc;
    const current = doc.versions.find((v) => v.version === doc.currentVersion);
    if (!current) return res.status(404).json({ message: "Current file missing" });

    // IMPORTANT FIX: strip leading "/" so path.join works correctly
    const relativePath = current.fileUrl.replace(/^\//, "");
    const filePath = path.join(__dirname, "..", relativePath);

    return res.download(filePath, current.fileName);
  } catch (e) {
    return res.status(500).json({ message: "Download failed" });
  }
};