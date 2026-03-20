const express = require("express");
const router = express.Router();

const {
  getRisks,
  getRiskById,
  createRisk,
  updateRisk,
  deleteRisk,
  getRiskStats,
  getProjectsForRisk,
} = require("../controllers/riskController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.use(protect);
router.use(authorizeRoles("admin", "project-manager"));

router.get("/", getRisks);
router.get("/projects/list", getProjectsForRisk);
router.get("/stats/summary", getRiskStats);
router.get("/:id", getRiskById);
router.post("/", createRisk);
router.put("/:id", updateRisk);
router.delete("/:id", deleteRisk);

module.exports = router;