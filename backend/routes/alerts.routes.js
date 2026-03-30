const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  getMyAlerts,
  getUnreadAlertCount,
  markAlertAsRead,
  markAllAlertsAsRead,
} = require("../controllers/alertsController");

router.get("/alerts", authMiddleware, getMyAlerts);
router.get("/alerts/unread-count", authMiddleware, getUnreadAlertCount);
router.patch("/alerts/:id/read", authMiddleware, markAlertAsRead);
router.patch("/alerts/read-all", authMiddleware, markAllAlertsAsRead);

module.exports = router;