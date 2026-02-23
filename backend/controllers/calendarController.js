// backend/controllers/calendarController.js
const Project = require("../models/Project");
const Task = require("../models/Task");
const CalendarEvent = require("../models/CalendarEvent");

// ---------- helpers ----------
const normalizeRole = (role) => {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "admin";
  if (["project-manager", "projectmanager", "project manager", "pm"].includes(r)) return "project-manager";
  if (["team-member", "teammember", "team member", "member"].includes(r)) return "team-member";
  if (r === "client") return "client";
  return r;
};

const role = (req) => normalizeRole(req.user?.role);
const isAdmin = (req) => role(req) === "admin";
const isPM = (req) => role(req) === "project-manager";
const isTeam = (req) => role(req) === "team-member";
const isClient = (req) => role(req) === "client";

const userIdFromReq = (req) => String(req.user?.id || req.user?._id || "");

const toYMD = (d) => new Date(d).toISOString().slice(0, 10);

const TYPE_COLORS = {
  meeting: "#3B82F6",
  deadline: "#EF4444",
  review: "#A855F7",
  planning: "#22C55E",
  presentation: "#EAB308",
  event: "#64748B",
};
const getTypeColor = (type) => TYPE_COLORS[type] || TYPE_COLORS.event;

/**
 * Robust project visibility filter (handles schema field name differences)
 */
const getProjectVisibilityFilter = (req) => {
  const userId = userIdFromReq(req);
  if (isAdmin(req)) return {}; // all projects

  // client can be stored as clientId/client/customerId/customer
  if (isClient(req)) {
    return {
      $or: [
        { clientId: userId },
        { client: userId },
        { customerId: userId },
        { customer: userId },
      ],
    };
  }

  // team member can be stored as members/teamMembers/team/assignedMembers
  if (isTeam(req)) {
    return {
      $or: [
        { members: userId },
        { teamMembers: userId },
        { team: userId },
        { assignedMembers: userId },
      ],
    };
  }

  // project manager can be stored as projectManager/projectManagerId/pmId/createdBy/owner
  if (isPM(req)) {
    return {
      $or: [
        { projectManager: userId },
        { projectManagerId: userId },
        { pmId: userId },
        { createdBy: userId },
        { owner: userId },
      ],
    };
  }

  // fallback: nothing
  return { _id: null };
};

// =====================================================
// GET /api/calendar/projects
// Returns projects visible to the current user
// =====================================================
exports.getVisibleProjects = async (req, res) => {
  try {
    const projFilter = getProjectVisibilityFilter(req);
    const projects = await Project.find(projFilter).select("_id name").sort({ name: 1 });
    return res.json({ projects });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =====================================================
// POST /api/calendar/events
// Body: { title, description, date(YYYY-MM-DD), time, type, projectId }
// =====================================================
exports.createEvent = async (req, res) => {
  try {
    const { title, description = "", date, time = "", type, projectId } = req.body || {};

    if (!title || !String(title).trim()) return res.status(400).json({ message: "title is required" });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    if (!type || !["meeting", "deadline", "review", "planning", "presentation"].includes(String(type))) {
      return res.status(400).json({ message: "invalid type" });
    }
    if (!projectId) return res.status(400).json({ message: "projectId is required" });

    // ensure user can add events to that project
    const projFilter = getProjectVisibilityFilter(req);
    const project = await Project.findOne(isAdmin(req) ? { _id: projectId } : { ...projFilter, _id: projectId }).select("_id name");
    if (!project) return res.status(403).json({ message: "You are not allowed to add events for this project." });

    const created = await CalendarEvent.create({
      title: String(title).trim(),
      description: String(description || ""),
      date: new Date(String(date)),
      time: String(time || ""),
      type: String(type),
      projectId,
      createdBy: userIdFromReq(req),
    });

    return res.status(201).json({
      event: {
        _id: String(created._id),
        title: created.title,
        description: created.description,
        date: toYMD(created.date),
        time: created.time,
        type: created.type,
        color: getTypeColor(created.type),
        projectId: String(project._id),
        projectName: project.name,
        source: "custom",
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =====================================================
// GET /api/calendar/events?month=YYYY-MM
// =====================================================
exports.getEvents = async (req, res) => {
  try {
    const month = String(req.query.month || "").trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month query must be YYYY-MM" });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const projFilter = getProjectVisibilityFilter(req);
    const projects = await Project.find(projFilter).select("_id name dueDate");
    const projectIds = projects.map((p) => p._id);

    if (projectIds.length === 0) return res.json({ events: [] });

    const projectNameMap = new Map(projects.map((p) => [String(p._id), p.name]));

    // Tasks due in that month
    let taskQuery = {
      projectId: { $in: projectIds },
      dueDate: { $gte: start, $lt: end },
    };

    // keep your rule: team member sees only assigned tasks
    if (isTeam(req)) {
      taskQuery.assignedTo = userIdFromReq(req);
    }

    const tasks = await Task.find(taskQuery).select("_id title dueDate projectId status");

    const taskEvents = tasks.map((t) => ({
      _id: `task-${t._id}`,
      title: t.title,
      date: toYMD(t.dueDate),
      time: "",
      type: "deadline",
      color: getTypeColor("deadline"),
      projectId: String(t.projectId),
      projectName: projectNameMap.get(String(t.projectId)) || "Project",
      source: "task",
    }));

    // Project due dates
    const projectEvents = projects
      .filter((p) => p.dueDate && p.dueDate >= start && p.dueDate < end)
      .map((p) => ({
        _id: `project-${p._id}`,
        title: `Project Due: ${p.name}`,
        date: toYMD(p.dueDate),
        time: "",
        type: "deadline",
        color: getTypeColor("deadline"),
        projectId: String(p._id),
        projectName: p.name,
        source: "project",
      }));

    // Custom calendar events
    const custom = await CalendarEvent.find({
      projectId: { $in: projectIds },
      date: { $gte: start, $lt: end },
    }).select("_id title description date time type projectId");

    const customEvents = custom.map((e) => ({
      _id: `custom-${e._id}`,
      title: e.title,
      description: e.description || "",
      date: toYMD(e.date),
      time: e.time || "",
      type: e.type,
      color: getTypeColor(e.type),
      projectId: String(e.projectId),
      projectName: projectNameMap.get(String(e.projectId)) || "Project",
      source: "custom",
    }));

    return res.json({ events: [...taskEvents, ...projectEvents, ...customEvents] });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};