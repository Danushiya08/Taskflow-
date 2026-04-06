const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

router.get("/test", protect, (req, res) => {
  res.json({ message: "Protected route working ✅", user: req.user });
});

module.exports = router;