const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const User = require("../models/User");

// ✅ GET /api/users  (protected) - list users for dropdowns
router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find().select("_id name email role").sort({ name: 1 });
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;