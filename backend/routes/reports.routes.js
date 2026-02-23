// backend/routes/reports.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const reportsController = require("../controllers/reportsController");

router.get("/dashboard", authMiddleware, reportsController.getDashboard);
router.get("/export/pdf", authMiddleware, reportsController.exportDashboardPDF);

module.exports = router;
