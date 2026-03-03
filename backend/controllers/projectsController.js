const Project = require("../models/Project");
const ProjectMember = require("../models/ProjectMember");

exports.listMyProjects = async (req, res) => {
  try {
    // Admin: return all projects with roleInProject = admin
    if (String(req.user?.role || "").toLowerCase() === "admin") {
      const projects = await Project.find().sort({ createdAt: -1 });
      const out = projects.map((p) => ({
        _id: p._id,
        name: p.name,
        roleInProject: "admin",
      }));
      return res.json({ projects: out });
    }

    // Non-admin: only membership projects
    const memberships = await ProjectMember.find({ user: req.user._id }).populate("project", "name");
    const out = memberships
      .filter((m) => m.project)
      .map((m) => ({
        _id: m.project._id,
        name: m.project.name,
        roleInProject: m.roleInProject,
      }));

    return res.json({ projects: out });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load projects" });
  }
};