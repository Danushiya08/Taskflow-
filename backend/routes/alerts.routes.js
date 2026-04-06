const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getMyAlerts,
  getUnreadAlertCount,
  markAlertAsRead,
  markAllAlertsAsRead,
} = require("../controllers/alertsController");

router.get("/alerts", protect, getMyAlerts);
router.get("/alerts/unread-count", protect, getUnreadAlertCount);
router.patch("/alerts/:id/read", protect, markAlertAsRead);
router.patch("/alerts/read-all", protect, markAllAlertsAsRead);

module.exports = router;