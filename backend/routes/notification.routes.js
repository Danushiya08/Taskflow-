const express = require("express");
const router = express.Router();

const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../controllers/notificationController");

const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getNotifications);
router.patch("/read-all", markAllNotificationsAsRead);
router.patch("/:id/read", markNotificationAsRead);

module.exports = router;