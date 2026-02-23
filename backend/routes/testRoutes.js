const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

router.get("/test", authMiddleware, (req, res) => {
  res.json({ message: "Protected route working ✅", user: req.user });
});

module.exports = router;