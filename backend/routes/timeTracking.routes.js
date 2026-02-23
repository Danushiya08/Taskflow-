const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const ctrl = require("../controllers/timeTrackingController");

// Debug
console.log("CTRL KEYS:", Object.keys(ctrl));

// Time Entries
router.post("/time-entries", authMiddleware, ctrl.createEntry);
router.get("/time-entries", authMiddleware, ctrl.getEntries);

if (typeof ctrl.updateEntry === "function") {
  router.patch("/time-entries/:id", authMiddleware, ctrl.updateEntry);
}

router.delete("/time-entries/:id", authMiddleware, ctrl.deleteEntry);

router.get("/time-entries/summary/today", authMiddleware, ctrl.todaySummary);

// Timesheets
router.get("/timesheets", authMiddleware, ctrl.getTimesheets);
router.post("/timesheets/submit", authMiddleware, ctrl.submitTimesheet);
router.patch("/timesheets/:id/review", authMiddleware, ctrl.reviewTimesheet);

// Work policy
if (typeof ctrl.getWorkPolicy === "function") {
  router.get("/work-policy", authMiddleware, ctrl.getWorkPolicy);
}
if (typeof ctrl.updateWorkPolicy === "function") {
  router.put("/work-policy", authMiddleware, ctrl.updateWorkPolicy);
}

// Reports
if (typeof ctrl.reportOrgSummary === "function") {
  router.get("/reports/org", authMiddleware, ctrl.reportOrgSummary);
}

if (typeof ctrl.reportProjectSummary === "function") {
  router.get("/reports/project/:projectId", authMiddleware, ctrl.reportProjectSummary);
}

if (typeof ctrl.reportFlags === "function") {
  router.get("/reports/flags", authMiddleware, ctrl.reportFlags);
}

// Exports
if (typeof ctrl.exportEntriesCSV === "function") {
  router.get("/exports/time-entries.csv", authMiddleware, ctrl.exportEntriesCSV);
}
if (typeof ctrl.exportEntriesPDF === "function") {
  router.get("/exports/time-entries.pdf", authMiddleware, ctrl.exportEntriesPDF);
}

// Audit
if (typeof ctrl.getAuditLogs === "function") {
  router.get("/audit", authMiddleware, ctrl.getAuditLogs);
}

module.exports = router;
