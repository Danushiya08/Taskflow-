// backend/routes/reports.routes.js
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const reportsController = require("../controllers/reportsController");

router.get("/dashboard", protect, reportsController.getDashboard);
router.get("/export/pdf", protect, reportsController.exportDashboardPDF);

module.exports = router;
