const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const User = require("../models/User");

// GET /api/me (protected)
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;