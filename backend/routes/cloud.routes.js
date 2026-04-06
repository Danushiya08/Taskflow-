const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const cloudController = require("../controllers/cloudController");

router.get("/cloud/google/auth-url", protect, cloudController.getGoogleAuthUrl);
router.get("/cloud/dropbox/auth-url", protect, cloudController.getDropboxAuthUrl);
router.get("/cloud/onedrive/auth-url", protect, cloudController.getOneDriveAuthUrl);

module.exports = router;