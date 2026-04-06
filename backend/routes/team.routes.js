// backend/routes/team.routes.js
const express = require("express");
const router = express.Router();

const mongoose = require("mongoose"); 

const { protect } = require("../middleware/authMiddleware");
const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");

// ---------- quick ping ----------
router.get("/__ping", (req, res) => res.json({ ok: true }));

// ---------- helpers ----------
const normalizeRole = (role) => {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "admin";
  if (["project-manager", "projectmanager", "project manager", "pm"].includes(r))
    return "project-manager";
  if (["team-member", "teammember", "team member", "member"].includes(r))
    return "team-member";
  if (r === "client") return "client";
  return r;
};

const roleOf = (req) => normalizeRole(req.user?.role);
const isAdmin = (req) => roleOf(req) === "admin";
const isPM = (req) => roleOf(req) === "project-manager";
const isTeam = (req) => roleOf(req) === "team-member";
const isClient = (req) => roleOf(req) === "client";

const canViewTeam = (req) => isAdmin(req) || isPM(req) || isTeam(req);
const canViewStats = (req) => isAdmin(req) || isPM(req);
const canChangeRole = (req) => isAdmin(req);
const canToggleUser = (req) => isAdmin(req) || isPM(req);
const canAddMember = (req) => isAdmin(req) || isPM(req);

// last active label
const lastActiveLabel = (date) => {
  if (!date) return "Offline";
  const diffMs = Date.now() - new Date(date).getTime();
  if (diffMs < 60 * 1000) return "Last active: just now";
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 60) return `Last active: ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last active: ${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `Last active: ${days} day${days > 1 ? "s" : ""} ago`;
};

// =====================================================
// ✅ USER DETAILS (Admin/PM only)
// GET /api/team/users/:id/details
// =====================================================
router.get("/users/:id/details", protect, async (req, res) => {
  try {
    if (!canViewStats(req) || isClient(req)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const userId = req.params.id;

    // ✅ Prevent CastError => 500
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    // user basic
    const user = await User.findById(userId).select(
      "_id name email role isActive createdAt lastActiveAt"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    // projects where user is PM or member
    const projects = await Project.find({
      $or: [{ projectManager: userId }, { members: userId }],
    })
      .select("_id name title projectName status createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const cleanProjectName = (p) =>
      p.name || p.title || p.projectName || "Untitled Project";

    const projectList = projects.map((p) => ({
      _id: p._id,
      name: cleanProjectName(p),
      status: p.status || null,
      createdAt: p.createdAt || null,
    }));

    // tasks assigned to user (support both assignedTo / assignee)
    const tasks = await Task.find({
      $or: [{ assignedTo: userId }, { assignee: userId }],
    })
      .select(
        "_id title name taskName status priority dueDate project assignedBy createdBy createdAt"
      )
      .populate({
        path: "project",
        select: "name title projectName",
        strictPopulate: false, // ✅ prevents populate crash if schema doesn't define "project"
      })
      .sort({ createdAt: -1 })
      .lean();

    const cleanTaskTitle = (t) =>
      t.title || t.name || t.taskName || "Untitled Task";

    const cleanProjectFromTask = (t) => {
      const p = t.project;
      if (!p) return null;
      return p.name || p.title || p.projectName || "Project";
    };

    // status counts
    const statusCounts = { todo: 0, inprogress: 0, done: 0 };

    for (const t of tasks) {
      const s = String(t.status || "").toLowerCase();
      if (s === "todo" || s === "to do") statusCounts.todo++;
      else if (s === "inprogress" || s === "in progress")
        statusCounts.inprogress++;
      else if (s === "done") statusCounts.done++;
    }

    // workload
    const totalTasks = tasks.length;
    const workloadPct = totalTasks === 0 ? 0 : Math.min(100, totalTasks * 10);

    const taskList = tasks.map((t) => ({
      _id: t._id,
      title: cleanTaskTitle(t),
      status: t.status || null,
      priority: t.priority || null,
      dueDate: t.dueDate || null,
      projectName: cleanProjectFromTask(t),
      createdAt: t.createdAt || null,
    }));

    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: normalizeRole(user.role),
        isActive: typeof user.isActive === "boolean" ? user.isActive : true,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt || null,
        lastActiveLabel: lastActiveLabel(user.lastActiveAt),
      },
      summary: {
        totalProjects: projectList.length,
        totalTasks,
        workloadPct,
        statusCounts,
      },
      projects: projectList,
      tasks: taskList,
    });
  } catch (err) {
    console.error("USER DETAILS ERROR:", err); // ✅ so you can see the real error
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// GET TEAM USERS (clients excluded)
// =====================================================
router.get("/users", protect, async (req, res) => {
  try {
    if (!canViewTeam(req) || isClient(req))
      return res.status(403).json({ message: "Not allowed" });

    // never return clients
    const users = await User.find({ role: { $ne: "client" } })
      .select("_id name email role isActive createdAt lastActiveAt")
      .sort({ createdAt: -1 });

    // Team member -> read-only
    if (!canViewStats(req)) {
      return res.json({
        users: users.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: normalizeRole(u.role),
          isActive: typeof u.isActive === "boolean" ? u.isActive : true,
          createdAt: u.createdAt,
          lastActiveAt: u.lastActiveAt || null,
          lastActiveLabel: lastActiveLabel(u.lastActiveAt),
          projectsCount: null,
          tasksCount: null,
          projects: [],
          tasks: [],
          topAssignedBy: null,
        })),
      });
    }

    const userIds = users.map((u) => u._id);

    // Projects list per user
    const projects = await Project.find({
      $or: [{ projectManager: { $in: userIds } }, { members: { $in: userIds } }],
    })
      .select("_id name title projectName projectManager members createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const projectsByUser = new Map();
    const pushProject = (uid, p) => {
      const k = String(uid);
      if (!projectsByUser.has(k)) projectsByUser.set(k, []);
      const pname = p.name || p.title || p.projectName || "Untitled Project";
      projectsByUser.get(k).push({ _id: p._id, name: pname });
    };

    for (const p of projects) {
      if (p.projectManager) pushProject(p.projectManager, p);
      if (Array.isArray(p.members)) {
        for (const m of p.members) pushProject(m, p);
      }
    }

    // Tasks list per user
    const tasks = await Task.find({ assignedTo: { $in: userIds } })
      .select("_id title name taskName assignedTo createdBy assignedBy createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const tasksByUser = new Map();
    const assignedByCount = new Map();

    const taskTitle = (t) => t.title || t.name || t.taskName || "Untitled Task";
    const getAssigner = (t) => t.assignedBy || t.createdBy || null;

    for (const t of tasks) {
      const uid = String(t.assignedTo);
      if (!tasksByUser.has(uid)) tasksByUser.set(uid, []);
      tasksByUser.get(uid).push({
        _id: t._id,
        title: taskTitle(t),
        assignedBy: getAssigner(t) ? String(getAssigner(t)) : null,
      });

      const assigner = getAssigner(t) ? String(getAssigner(t)) : null;
      if (assigner) {
        if (!assignedByCount.has(uid)) assignedByCount.set(uid, new Map());
        const inner = assignedByCount.get(uid);
        inner.set(assigner, (inner.get(assigner) || 0) + 1);
      }
    }

    const assignerIds = new Set();
    for (const inner of assignedByCount.values()) {
      for (const aid of inner.keys()) assignerIds.add(aid);
    }

    const assigners = assignerIds.size
      ? await User.find({ _id: { $in: Array.from(assignerIds) } })
          .select("_id name email")
          .lean()
      : [];

    const assignerNameMap = new Map(
      assigners.map((a) => [String(a._id), a.name || a.email || "User"])
    );

    const topAssignedByForUser = (uid) => {
      const inner = assignedByCount.get(uid);
      if (!inner) return null;
      let top = null;
      for (const [aid, cnt] of inner.entries()) {
        if (!top || cnt > top.count) top = { assignerId: aid, count: cnt };
      }
      if (!top) return null;
      return {
        name: assignerNameMap.get(top.assignerId) || "User",
        count: top.count,
      };
    };

    const out = users.map((u) => {
      const uid = String(u._id);
      const pList = projectsByUser.get(uid) || [];
      const tList = tasksByUser.get(uid) || [];
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: normalizeRole(u.role),
        isActive: typeof u.isActive === "boolean" ? u.isActive : true,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt || null,
        lastActiveLabel: lastActiveLabel(u.lastActiveAt),
        projectsCount: pList.length,
        tasksCount: tList.length,
        projects: pList.slice(0, 5),
        tasks: tList.slice(0, 5),
        topAssignedBy: topAssignedByForUser(uid),
      };
    });

    res.json({ users: out });
  } catch (err) {
    console.error("TEAM USERS ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// ADD MEMBER (Admin + PM)
// =====================================================
router.post("/users", protect, async (req, res) => {
  try {
    if (!canAddMember(req) || isClient(req))
      return res.status(403).json({ message: "Not allowed" });

    const { name, email, role, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    let nextRole = normalizeRole(role || "team-member");
    if (isPM(req)) nextRole = "team-member";

    if (!["admin", "project-manager", "team-member"].includes(nextRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const exists = await User.findOne({
      email: String(email).toLowerCase().trim(),
    }).select("_id");
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const user = await User.create({
      name: name.trim(),
      email: String(email).toLowerCase().trim(),
      role: nextRole,
      password: password.trim(),
      isActive: true,
    });

    return res.status(201).json({
      message: "Member added",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: normalizeRole(user.role),
        isActive: true,
      },
    });
  } catch (err) {
    console.error("ADD MEMBER ERROR:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// ADMIN ONLY: Change role
// =====================================================
router.patch("/users/:id/role", protect, async (req, res) => {
  try {
    if (!canChangeRole(req)) return res.status(403).json({ message: "Not allowed" });

    const userId = req.params.id;
    const nextRole = normalizeRole(req.body?.role);

    if (!["admin", "project-manager", "team-member"].includes(nextRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (String(userId) === String(req.user?.id || req.user?._id) && nextRole !== "admin") {
      return res.status(400).json({ message: "You cannot change your own admin role" });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { role: nextRole },
      { new: true }
    ).select("_id name email role isActive");

    if (!updated) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Role updated", user: updated });
  } catch (err) {
    console.error("CHANGE ROLE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// Enable/Disable (Admin & PM)
// =====================================================
router.patch("/users/:id/toggle", protect, async (req, res) => {
  try {
    if (!canToggleUser(req)) return res.status(403).json({ message: "Not allowed" });

    const target = await User.findById(req.params.id).select("_id role isActive");
    if (!target) return res.status(404).json({ message: "User not found" });

    const targetRole = normalizeRole(target.role);

    if (isPM(req) && (targetRole === "admin" || targetRole === "project-manager")) {
      return res.status(403).json({
        message: "Project Manager cannot disable Admin/Project Manager",
      });
    }

    const next = !(typeof target.isActive === "boolean" ? target.isActive : true);
    target.isActive = next;
    await target.save();

    res.json({ message: next ? "User enabled" : "User disabled", isActive: target.isActive });
  } catch (err) {
    console.error("TOGGLE USER ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// =====================================================
// DELETE USER (Admin + PM)
// =====================================================
router.delete("/users/:id", protect, async (req, res) => {
  try {
    if (!(isAdmin(req) || isPM(req))) return res.status(403).json({ message: "Not allowed" });

    const target = await User.findById(req.params.id).select("_id role");
    if (!target) return res.status(404).json({ message: "User not found" });

    const targetRole = normalizeRole(target.role);

    if (isAdmin(req) && targetRole === "admin") {
      return res.status(403).json({ message: "Cannot delete an Admin user" });
    }

    if (isPM(req) && targetRole !== "team-member") {
      return res.status(403).json({ message: "Project Manager can delete only Team Members" });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
