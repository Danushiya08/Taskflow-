const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const Activity = require("../models/Activity");
const ProjectMember = require("../models/ProjectMember");
const Project = require("../models/Project");

router.use(protect);

// helpers

const getUserId = (req) =>
  String(req.user?.id || req.user?._id || "");

const normalizeRole = (role) => {
  const r = String(role || "").toLowerCase();

  if (r === "admin") return "admin";
  if (r.includes("project")) return "project-manager";
  if (r.includes("team")) return "team-member";
  if (r === "client") return "client";

  return r;
};

// =============================
// GET ACTIVITY (ROLE BASED)
// =============================

router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    const role = normalizeRole(req.user?.role);

    // Admin → see all
    if (role === "admin") {
      const activities = await Activity.find({})
        .populate("user", "name email role")
        .populate("project", "name")
        .populate("task", "title")
        .sort({ createdAt: -1 })
        .limit(200);

      return res.json({ activities });
    }

    // Client → only their projects
    if (role === "client") {
      const projects = await Project.find({ client: userId }).select("_id");

      const projectIds = projects.map((p) => p._id);

      const activities = await Activity.find({
        project: { $in: projectIds },
      })
        .populate("user", "name email role")
        .populate("project", "name")
        .populate("task", "title")
        .sort({ createdAt: -1 })
        .limit(200);

      return res.json({ activities });
    }

    // PM / Team → membership based

    const memberships = await ProjectMember.find({
      user: userId,
    }).select("project");

    const projectIds = memberships.map((m) => m.project);

    const activities = await Activity.find({
      project: { $in: projectIds },
    })
      .populate("user", "name email role")
      .populate("project", "name")
      .populate("task", "title")
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({ activities });

  } catch (error) {
    console.error("Get activity error:", error);
    return res.status(500).json({
      message: "Failed to fetch activity",
    });
  }
});

module.exports = router;