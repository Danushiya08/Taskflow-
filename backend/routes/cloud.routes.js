const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const cloudController = require("../controllers/cloudController");

router.get("/cloud/google/auth-url", authMiddleware, cloudController.getGoogleAuthUrl);
router.get("/cloud/dropbox/auth-url", authMiddleware, cloudController.getDropboxAuthUrl);
router.get("/cloud/onedrive/auth-url", authMiddleware, cloudController.getOneDriveAuthUrl);

module.exports = router;