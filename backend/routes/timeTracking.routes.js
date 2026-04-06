const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const ctrl = require("../controllers/timeTrackingController");

// Debug
console.log("CTRL KEYS:", Object.keys(ctrl));

// Time Entries
router.post("/time-entries", protect, ctrl.createEntry);
router.get("/time-entries", protect, ctrl.getEntries);

if (typeof ctrl.updateEntry === "function") {
  router.patch("/time-entries/:id", protect, ctrl.updateEntry);
}

router.delete("/time-entries/:id", protect, ctrl.deleteEntry);

router.get("/time-entries/summary/today", protect, ctrl.todaySummary);

// Timesheets
router.get("/timesheets", protect, ctrl.getTimesheets);
router.post("/timesheets/submit", protect, ctrl.submitTimesheet);
router.patch("/timesheets/:id/review", protect, ctrl.reviewTimesheet);

// Work policy
if (typeof ctrl.getWorkPolicy === "function") {
  router.get("/work-policy", protect, ctrl.getWorkPolicy);
}
if (typeof ctrl.updateWorkPolicy === "function") {
  router.put("/work-policy", protect, ctrl.updateWorkPolicy);
}

// Reports
if (typeof ctrl.reportOrgSummary === "function") {
  router.get("/reports/org", protect, ctrl.reportOrgSummary);
}

if (typeof ctrl.reportProjectSummary === "function") {
  router.get("/reports/project/:projectId", protect, ctrl.reportProjectSummary);
}

if (typeof ctrl.reportFlags === "function") {
  router.get("/reports/flags", protect, ctrl.reportFlags);
}

// Exports
if (typeof ctrl.exportEntriesCSV === "function") {
  router.get("/exports/time-entries.csv", protect, ctrl.exportEntriesCSV);
}
if (typeof ctrl.exportEntriesPDF === "function") {
  router.get("/exports/time-entries.pdf", protect, ctrl.exportEntriesPDF);
}

// Audit
if (typeof ctrl.getAuditLogs === "function") {
  router.get("/audit", protect, ctrl.getAuditLogs);
}

module.exports = router;
