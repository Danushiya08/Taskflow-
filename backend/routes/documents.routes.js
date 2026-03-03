const router = require("express").Router();

const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { requireProjectAccess, requireDocumentAccess } = require("../middleware/docAccessMiddleware");

const ctrl = require("../controllers/documentsController");

// Project-scoped routes
router.get("/projects/:projectId/documents", authMiddleware, requireProjectAccess, ctrl.listDocuments);

router.post(
  "/projects/:projectId/documents",
  authMiddleware,
  requireProjectAccess,
  upload.single("file"),
  ctrl.uploadDocument
);

// Document-scoped routes
router.get("/documents/:id/versions", authMiddleware, requireDocumentAccess, ctrl.getVersions);
router.post("/documents/:id/restore/:version", authMiddleware, requireDocumentAccess, ctrl.restoreVersion);
router.post("/documents/:id/share", authMiddleware, requireDocumentAccess, ctrl.shareDocument);
router.get("/documents/:id/download", authMiddleware, requireDocumentAccess, ctrl.downloadCurrent);

module.exports = router;