const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const ProjectMember = require("../models/ProjectMember");

router.get("/projects/roles", authMiddleware, async (req, res) => {
  try {
    // Admin can be treated as admin everywhere
    if (String(req.user?.role || "").toLowerCase() === "admin") {
      return res.json({ roles: {}, isAdmin: true });
    }

    const memberships = await ProjectMember.find({ user: req.user._id }).select("project roleInProject");
    const roles = {};
    for (const m of memberships) roles[String(m.project)] = m.roleInProject;

    return res.json({ roles, isAdmin: false });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load project roles" });
  }
});

module.exports = router;