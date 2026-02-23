// backend/controllers/reportsController.js
const Project = require("../models/Project");
const Task = require("../models/Task");
const TimeEntry = require("../models/TimeEntry");
const User = require("../models/User");
const PDFDocument = require("pdfkit");

// ---------------- helpers ----------------
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
const isClient = (req) => role(req) === "client";
const isTeam = (req) => role(req) === "team-member";

const userId = (req) => String(req.user?.id || req.user?._id || "");

const rangeToDates = (range) => {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  const r = String(range || "last-30-days");
  if (r === "last-7-days") start.setDate(start.getDate() - 6);
  else if (r === "last-90-days") start.setDate(start.getDate() - 89);
  else if (r === "this-year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const isoDate = (d) => {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
};

const weekKey = (d) => {
  const dt = new Date(d);
  const day = dt.getDay(); // Sun=0
  const diff = day === 0 ? -6 : 1 - day; // monday start
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
};

// ✅ IMPORTANT:  Project schema doesn't have clientId/client,
// so we treat "client's projects" as projects where the client user is in members[].
const buildProjectScope = (req) => {
  if (isAdmin(req)) return { archived: { $ne: true } };
  if (isPM(req)) return { projectManager: userId(req), archived: { $ne: true } };
  if (isClient(req)) return { members: userId(req), archived: { $ne: true } };
  return null;
};

// ---------------- controllers ----------------
exports.getDashboard = async (req, res) => {
  try {
    if (isTeam(req)) {
      return res.status(403).json({ message: "Team members do not have access to reports" });
    }

    const { range, projectId } = req.query;
    const { start, end } = rangeToDates(range);

    // ---------------- SCOPE ----------------
    let projectScope = buildProjectScope(req);
    if (!projectScope) return res.status(403).json({ message: "Not allowed" });

    if (projectId) projectScope = { ...projectScope, _id: projectId };

    const projects = await Project.find(projectScope).select(
      "_id name status createdAt updatedAt budget progress archived members projectManager"
    );

    const projectIds = projects.map((p) => p._id);

    // If no projects in scope
    if (projectIds.length === 0) {
      return res.json({
        scope: role(req),
        range: { start: isoDate(start), end: isoDate(end) },
        kpis: {
          projectsCompleted: { value: 0, deltaPct: 0 },
          avgTaskVelocity: { value: 0, deltaPct: 0 },
          teamProductivity: { value: 0, status: "N/A" },
          budgetEfficiency: { value: 0, status: "N/A" },
        },
        charts: {
          completionTrend: [],
          taskVelocity: [],
          timeDistribution: [],
          productivityByMember: [],
          budgetByProject: [],
        },
      });
    }

    // ---------------- PROJECT COMPLETION TREND (monthly) ----------------
    const completionTrendAgg = await Project.aggregate([
      { $match: { _id: { $in: projectIds }, updatedAt: { $gte: start, $lte: end } } },
      {
        $project: {
          month: { $dateToString: { format: "%b", date: "$updatedAt" } },
          isCompleted: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          isInProgress: { $cond: [{ $eq: ["$status", "completed"] }, 0, 1] },
        },
      },
      {
        $group: {
          _id: "$month",
          completed: { $sum: "$isCompleted" },
          inProgress: { $sum: "$isInProgress" },
        },
      },
      { $project: { _id: 0, month: "$_id", completed: 1, inProgress: 1 } },
    ]);

    // ---------------- TASKS (filter by range for realistic velocity/productivity) ----------------
    const tasks = await Task.find({
      projectId: { $in: projectIds },
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { updatedAt: { $gte: start, $lte: end } },
      ],
    }).select("_id projectId assignedTo status createdAt updatedAt category");

    // ---------------- TASK VELOCITY (weekly) ----------------
    const velocityMap = new Map();
    for (const t of tasks) {
      const plannedW = t.createdAt ? weekKey(t.createdAt) : null;
      if (plannedW) {
        if (!velocityMap.has(plannedW)) velocityMap.set(plannedW, { week: plannedW, planned: 0, completed: 0 });
        velocityMap.get(plannedW).planned += 1;
      }

      const doneW =
        String(t.status || "").toLowerCase() === "done" && t.updatedAt ? weekKey(t.updatedAt) : null;

      if (doneW) {
        if (!velocityMap.has(doneW)) velocityMap.set(doneW, { week: doneW, planned: 0, completed: 0 });
        velocityMap.get(doneW).completed += 1;
      }
    }

    const taskVelocity = Array.from(velocityMap.values())
      .filter((w) => {
        const d = new Date(w.week + "T00:00:00");
        return d >= start && d <= end;
      })
      .sort((a, b) => (a.week > b.week ? 1 : -1))
      .map((w, idx) => ({ week: `W${idx + 1}`, planned: w.planned, completed: w.completed }));

    // ---------------- TIME DISTRIBUTION (by task.category) ----------------

    const timeAgg = await TimeEntry.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          date: { $gte: isoDate(start), $lte: isoDate(end) },
        },
      },
      {
        $lookup: {
          from: "tasks",
          localField: "taskId",
          foreignField: "_id",
          as: "task",
        },
      },
      { $unwind: { path: "$task", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$task.category", "Uncategorized"] },
          seconds: { $sum: "$durationSeconds" },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          hours: { $round: [{ $divide: ["$seconds", 3600] }, 1] },
        },
      },
      { $sort: { hours: -1 } },
    ]);

    // ---------------- PRODUCTIVITY BY MEMBER ----------------
    let productivityByMember = [];
    if (!isClient(req)) {
      const perMember = new Map();

      for (const t of tasks) {
        const assignee = t.assignedTo ? String(t.assignedTo) : null;
        if (!assignee) continue;

        if (!perMember.has(assignee)) perMember.set(assignee, { userId: assignee, total: 0, done: 0 });
        const obj = perMember.get(assignee);

        obj.total += 1;
        if (String(t.status || "").toLowerCase() === "done") obj.done += 1;
      }

      const memberIds = Array.from(perMember.keys());
      const users = await User.find({ _id: { $in: memberIds } }).select("_id name");
      const nameMap = new Map(users.map((u) => [String(u._id), u.name]));

      productivityByMember = Array.from(perMember.values()).map((m) => {
        const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
        return {
          userId: m.userId,
          name: nameMap.get(m.userId) || "User",
          productivity: pct,
          tasks: m.done,
        };
      });
    }

    // ---------------- BUDGET ----------------
    const budgetByProject =
      isAdmin(req) || isPM(req)
        ? projects.map((p) => {
            const allocated = Number(p?.budget?.allocated || 0);
            const spent = Number(p?.budget?.spent || 0);
            const percentage = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
            return { project: p.name, allocated, spent, percentage };
          })
        : [];

    // ---------------- KPI CALCS ----------------
    const completedNow = projects.filter((p) => String(p.status || "").toLowerCase() === "completed").length;

    // Previous period for delta
    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(-1);
    const prevStart = new Date(start);
    const diffMs = end.getTime() - start.getTime();
    prevStart.setTime(start.getTime() - diffMs);

    const prevProjects = await Project.find({
      ...projectScope,
      updatedAt: { $gte: prevStart, $lte: prevEnd },
    }).select("status");

    const completedPrev = prevProjects.filter((p) => String(p.status || "").toLowerCase() === "completed").length;

    const projectsDeltaPct = completedPrev > 0 ? Math.round(((completedNow - completedPrev) / completedPrev) * 100) : 0;

    const weeksCount = Math.max(1, taskVelocity.length);
    const avgVelocityValue =
      Math.round((taskVelocity.reduce((s, w) => s + (w.completed || 0), 0) / weeksCount) * 10) / 10;

    const teamProductivityValue =
      productivityByMember.length > 0
        ? Math.round(
            (productivityByMember.reduce((s, m) => s + (m.productivity || 0), 0) / productivityByMember.length) * 10
          ) / 10
        : 0;

    const totalAllocated = budgetByProject.reduce((s, b) => s + (b.allocated || 0), 0);
    const totalSpent = budgetByProject.reduce((s, b) => s + (b.spent || 0), 0);
    const budgetEfficiencyValue = totalAllocated > 0 ? Math.round(((totalAllocated - totalSpent) / totalAllocated) * 100) : 0;

    return res.json({
      scope: role(req),
      range: { start: isoDate(start), end: isoDate(end) },
      kpis: {
        projectsCompleted: { value: completedNow, deltaPct: projectsDeltaPct },
        avgTaskVelocity: { value: avgVelocityValue, deltaPct: 0 },
        teamProductivity: {
          value: teamProductivityValue,
          status: teamProductivityValue >= 80 ? "Excellent performance" : "Needs improvement",
        },
        budgetEfficiency: {
          value: budgetEfficiencyValue,
          status: budgetEfficiencyValue >= 20 ? "Within budget limits" : "Budget tight",
        },
      },
      charts: {
        completionTrend: completionTrendAgg,
        taskVelocity,
        // ✅ client restrictions
        timeDistribution: isClient(req) ? [] : timeAgg,
        productivityByMember: isClient(req) ? [] : productivityByMember,
        budgetByProject,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =====================================================
// ✅ EXPORT PDF (used by ReportsPage export button)
// GET /api/reports/export/pdf?range=last-30-days
// =====================================================
exports.exportDashboardPDF = async (req, res) => {
  try {
    if (isTeam(req)) {
      return res.status(403).json({ message: "Team members do not have access to report exports" });
    }

    const { range } = req.query;
    const { start, end } = rangeToDates(range);

    const projectScope = buildProjectScope(req);
    if (!projectScope) return res.status(403).json({ message: "Not allowed" });

    const projects = await Project.find(projectScope).select("name status budget updatedAt");
    const completedNow = projects.filter((p) => String(p.status || "").toLowerCase() === "completed").length;

    const allowBudget = isAdmin(req) || isPM(req);
    const totalAllocated = allowBudget ? projects.reduce((s, p) => s + Number(p?.budget?.allocated || 0), 0) : 0;
    const totalSpent = allowBudget ? projects.reduce((s, p) => s + Number(p?.budget?.spent || 0), 0) : 0;
    const budgetEfficiencyValue = totalAllocated > 0 ? Math.round(((totalAllocated - totalSpent) / totalAllocated) * 100) : 0;

    // PDF output
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="reports-dashboard.pdf"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).fillColor("#000").text("TaskFlow - Reports & Analytics", { align: "left" });
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor("#666").text(`Scope: ${role(req)}`);
    doc.text(`Range: ${isoDate(start)} to ${isoDate(end)}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(12).fillColor("#000").text("Summary", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11).text(`Projects Completed: ${completedNow}`);

    if (allowBudget) {
      doc.text(`Total Budget Allocated: $${Number(totalAllocated).toLocaleString()}`);
      doc.text(`Total Budget Spent: $${Number(totalSpent).toLocaleString()}`);
      doc.text(`Budget Efficiency: ${budgetEfficiencyValue}%`);
    } else {
      doc.text("Budget details: Restricted for client");
    }

    doc.moveDown();
    doc.fontSize(10).fillColor("#666").text("Charts are available in the web dashboard. PDF includes summary only.");
    doc.end();
  } catch (err) {
    return res.status(500).json({ message: "Export failed", error: err.message });
  }
};
