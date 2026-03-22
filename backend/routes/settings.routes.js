const express = require("express");
const router = express.Router();

const {
  getMySettings,
  updateProfileSettings,
  updateNotificationSettings,
  updatePreferenceSettings,
  updatePassword,
  toggleTwoFactor,
} = require("../controllers/settingsController");

const { protect } = require("../middleware/authMiddleware");

router.get("/me", protect, getMySettings);
router.put("/profile", protect, updateProfileSettings);
router.put("/notifications", protect, updateNotificationSettings);
router.put("/preferences", protect, updatePreferenceSettings);
router.put("/password", protect, updatePassword);
router.put("/2fa", protect, toggleTwoFactor);

module.exports = router;