const router = require("express").Router();

const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { requireProjectAccess, requireDocumentAccess,  requireRestorePermission } = require("../middleware/docAccessMiddleware");

const ctrl = require("../controllers/documentsController");

// Project-scoped routes
router.get("/projects/:projectId/documents", protect, requireProjectAccess, ctrl.listDocuments);

router.post(
  "/projects/:projectId/documents",
  protect,
  requireProjectAccess,
  upload.single("file"),
  ctrl.uploadDocument
);
router.get(
  "/documents",
  protect,
  ctrl.listAllDocuments
);

// Document-scoped routes
router.get("/documents/:id/versions", protect, requireDocumentAccess, ctrl.getVersions);
router.post("/documents/:id/restore/:version", protect, requireDocumentAccess, requireRestorePermission, ctrl.restoreVersion);
router.post("/documents/:id/share", protect, requireDocumentAccess, ctrl.shareDocument);
router.get("/documents/:id/download", protect, requireDocumentAccess, ctrl.downloadCurrent);
router.delete("/documents/:id", protect, requireDocumentAccess, ctrl.deleteDocument);

module.exports = router;