// controllers/timeTrackingController.js
const TimeEntry = require("../models/TimeEntry");
const Timesheet = require("../models/Timesheet");
const Task = require("../models/Task");
const Project = require("../models/Project");
const WorkPolicy = require("../models/WorkPolicy");
const AuditLog = require("../models/AuditLog");

const PDFDocument = require("pdfkit");

// -------------------- helpers --------------------
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

const isAdmin = (req) => normalizeRole(req.user?.role) === "admin";
const isPM = (req) => normalizeRole(req.user?.role) === "project-manager";
const isTeam = (req) => normalizeRole(req.user?.role) === "team-member";

const toISODate = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const startOfWeekMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // Sun=0
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeekSunday = (date) => {
  const s = startOfWeekMonday(date);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
};

async function getPMProjectIds(req) {
  if (!isPM(req)) return [];
  const list = await Project.find({ projectManager: req.user.id }).select("_id");
  return list.map((p) => String(p._id));
}

function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    ""
  );
}

async function audit(req, { action, entityType, entityId, before, after }) {
  try {
    await AuditLog.create({
      actorId: req.user.id,
      action,
      entityType,
      entityId,
      before: before ?? null,
      after: after ?? null,
      ip: getIP(req),
      userAgent: req.headers["user-agent"] || "",
    });
  } catch {
    // don't break main flow
  }
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

// -----------------------------------------------------------
// ✅ Create Time Entry
// FIX: status MUST match schema enum (pending/draft/approved/rejected)
// -----------------------------------------------------------
exports.createEntry = async (req, res) => {
  try {
    const requesterId = req.user.id;

    const { taskId, durationSeconds, notes, date, startTime, endTime, userId, isManual, manualReason } =
      req.body;

    if (!taskId || durationSeconds == null || Number(durationSeconds) <= 0) {
      return res
        .status(400)
        .json({ message: "taskId and valid durationSeconds are required" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const project = await Project.findById(task.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // PM scoping
    if (isPM(req)) {
      const pmProjects = await getPMProjectIds(req);
      if (!pmProjects.includes(String(task.projectId))) {
        return res
          .status(403)
          .json({ message: "PM can only create entries for their projects" });
      }
    }

    const finalUserId =
      (isAdmin(req) && userId) || (isPM(req) && userId)
        ? userId
        : requesterId;

    const entry = await TimeEntry.create({
      userId: finalUserId,
      taskId,
      projectId: task.projectId,
      date: date || toISODate(new Date()),
      durationSeconds: Number(durationSeconds),
      notes: notes || "",
      startTime: startTime || null,
      endTime: endTime || null,

      // manual support
      isManual: Boolean(isManual) || false,
      manualReason: manualReason ? String(manualReason) : "",

      // ✅ FIXED: must be in schema enum
      status: "pending",
    });

    await audit(req, {
      action: "CREATE",
      entityType: "TimeEntry",
      entityId: entry._id,
      before: null,
      after: entry.toObject(),
    });

    return res.status(201).json({ message: "Time entry created", entry });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Get time entries
// -----------------------------------------------------------
exports.getEntries = async (req, res) => {
  try {
    const { from, to, userId, projectId, taskId } = req.query;

    const query = {};

    // user scope
    if (isAdmin(req)) {
      if (userId) query.userId = userId;
    } else if (isPM(req)) {
      if (userId) query.userId = userId;
    } else {
      query.userId = req.user.id;
    }

    if (projectId) query.projectId = projectId;
    if (taskId) query.taskId = taskId;

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    if (isPM(req)) {
      const pmProjects = await getPMProjectIds(req);
      query.projectId = query.projectId ? query.projectId : { $in: pmProjects };

      if (projectId && !pmProjects.includes(String(projectId))) {
        return res.status(403).json({ message: "Not allowed project" });
      }
    }

    const entries = await TimeEntry.find(query)
      .populate("taskId", "title status priority")
      .populate("projectId", "name status projectManager")
      .sort({ createdAt: -1 });

    return res.json({ entries });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Update time entry
// -----------------------------------------------------------
exports.updateEntry = async (req, res) => {
  try {
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const before = entry.toObject();

    if (!isAdmin(req)) {
      if (isPM(req)) {
        const pmProjects = await getPMProjectIds(req);
        if (!pmProjects.includes(String(entry.projectId))) {
          return res.status(403).json({ message: "Not allowed" });
        }
      } else {
        if (String(entry.userId) !== String(req.user.id)) {
          return res.status(403).json({ message: "Not allowed" });
        }

        const ws = toISODate(startOfWeekMonday(new Date(entry.date + "T00:00:00")));
        const sheet = await Timesheet.findOne({ userId: req.user.id, weekStart: ws });

        if (sheet && ["pending", "approved"].includes(sheet.status)) {
          return res
            .status(400)
            .json({ message: "Entry is locked after timesheet submission" });
        }
      }
    }

    const { durationSeconds, notes, date, startTime, endTime, taskId } = req.body;

    if (taskId && String(taskId) !== String(entry.taskId)) {
      const task = await Task.findById(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      if (isPM(req)) {
        const pmProjects = await getPMProjectIds(req);
        if (!pmProjects.includes(String(task.projectId))) {
          return res.status(403).json({ message: "Not allowed project" });
        }
      }

      entry.taskId = taskId;
      entry.projectId = task.projectId;
    }

    if (durationSeconds != null) {
      const n = Number(durationSeconds);
      if (Number.isNaN(n) || n <= 0) {
        return res.status(400).json({ message: "durationSeconds must be > 0" });
      }
      entry.durationSeconds = n;
    }

    if (notes != null) entry.notes = String(notes);
    if (date != null) entry.date = String(date);
    if (startTime !== undefined) entry.startTime = startTime || null;
    if (endTime !== undefined) entry.endTime = endTime || null;

    // edit tracking
    entry.lastEditedBy = req.user.id;
    entry.lastEditedAt = new Date();

    await entry.save();

    await audit(req, {
      action: "UPDATE",
      entityType: "TimeEntry",
      entityId: entry._id,
      before,
      after: entry.toObject(),
    });

    return res.json({ message: "Entry updated", entry });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Delete time entry
// -----------------------------------------------------------
exports.deleteEntry = async (req, res) => {
  try {
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    if (!isAdmin(req)) {
      if (isPM(req)) {
        const pmProjects = await getPMProjectIds(req);
        if (!pmProjects.includes(String(entry.projectId))) {
          return res.status(403).json({ message: "Not allowed" });
        }
      } else {
        if (String(entry.userId) !== String(req.user.id)) {
          return res.status(403).json({ message: "Not allowed" });
        }
        const ws = toISODate(startOfWeekMonday(new Date(entry.date + "T00:00:00")));
        const sheet = await Timesheet.findOne({ userId: req.user.id, weekStart: ws });
        if (sheet && ["pending", "approved"].includes(sheet.status)) {
          return res
            .status(400)
            .json({ message: "Entry is locked after timesheet submission" });
        }
      }
    }

    await TimeEntry.deleteOne({ _id: entry._id });

    await audit(req, {
      action: "DELETE",
      entityType: "TimeEntry",
      entityId: entry._id,
      before: entry.toObject(),
      after: null,
    });

    return res.json({ message: "Entry deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Review a single entry (Admin/PM)
// FIX: Actually update the entry status + reviewer fields
// -----------------------------------------------------------
exports.reviewEntry = async (req, res) => {
  try {
    if (!isAdmin(req) && !isPM(req)) {
      return res.status(403).json({ message: "Only admin/PM can review entries" });
    }

    const { action, comment } = req.body; // approved/rejected
    if (!["approved", "rejected"].includes(action)) {
      return res.status(400).json({ message: "action must be approved or rejected" });
    }

    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    if (isPM(req)) {
      const pmProjects = await getPMProjectIds(req);
      if (!pmProjects.includes(String(entry.projectId))) {
        return res.status(403).json({ message: "Not allowed" });
      }
    }

    const before = entry.toObject();

    entry.status = action;
    entry.reviewedBy = req.user.id;
    entry.reviewedAt = new Date();
    entry.reviewComment = comment || "";

    await entry.save();

    await audit(req, {
      action: "REVIEW",
      entityType: "TimeEntry",
      entityId: entry._id,
      before,
      after: entry.toObject(),
    });

    return res.json({ message: `Entry ${action}`, entry });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Today summary
// -----------------------------------------------------------
exports.todaySummary = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const { userId } = req.query;

    const finalUserId =
      (isAdmin(req) || isPM(req)) && userId ? userId : requesterId;

    const today = toISODate(new Date());
    const entries = await TimeEntry.find({ userId: finalUserId, date: today });

    const totalSeconds = entries.reduce((s, e) => s + (e.durationSeconds || 0), 0);

    const uniqueTasks = new Set(entries.map((e) => String(e.taskId))).size;
    const uniqueProjects = new Set(entries.map((e) => String(e.projectId))).size;

    const byProject = {};
    for (const e of entries) {
      const k = String(e.projectId);
      byProject[k] = (byProject[k] || 0) + e.durationSeconds;
    }

    return res.json({
      date: today,
      totalSeconds,
      tasksTracked: uniqueTasks,
      projectsTracked: uniqueProjects,
      breakdown: byProject,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Get timesheets (auto computed)
// -----------------------------------------------------------
exports.getTimesheets = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const { userId } = req.query;

    const finalUserId =
      (isAdmin(req) || isPM(req)) && userId ? userId : requesterId;

    const entryQuery = { userId: finalUserId };

    if (isPM(req)) {
      const pmProjects = await getPMProjectIds(req);
      entryQuery.projectId = { $in: pmProjects };
    }

    const entries = await TimeEntry.find(entryQuery);

    const weekMap = new Map();

    for (const e of entries) {
      const d = new Date(e.date + "T00:00:00");
      const ws = toISODate(startOfWeekMonday(d));
      const we = toISODate(endOfWeekSunday(d));

      if (!weekMap.has(ws)) {
        weekMap.set(ws, { weekStart: ws, weekEnd: we, totalSeconds: 0, count: 0 });
      }
      const obj = weekMap.get(ws);
      obj.totalSeconds += e.durationSeconds;
      obj.count += 1;
    }

    const weeks = Array.from(weekMap.values()).sort((a, b) =>
      a.weekStart < b.weekStart ? 1 : -1
    );

    const weekStarts = weeks.map((w) => w.weekStart);

    const sheets = await Timesheet.find({
      userId: finalUserId,
      weekStart: { $in: weekStarts },
    });

    const sheetMap = new Map();
    for (const s of sheets) sheetMap.set(String(s.weekStart), s);

    const out = weeks.map((w) => {
      const sheet = sheetMap.get(String(w.weekStart));
      return {
        id: sheet ? String(sheet._id) : null,
        weekStart: w.weekStart,
        weekEnd: w.weekEnd,
        totalSeconds: w.totalSeconds,
        count: w.count,
        totalHours: Math.round((w.totalSeconds / 3600) * 10) / 10,
        status: sheet?.status || "draft",
        submittedAt: sheet?.submittedAt || null,
        reviewedAt: sheet?.reviewedAt || null,
        reviewedBy: sheet?.reviewedBy || null,
        reviewComment: sheet?.reviewComment || "",
      };
    });

    return res.json({ timesheets: out });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Submit timesheet (current week)
// -----------------------------------------------------------
exports.submitTimesheet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { weekStart } = req.body;
    if (!weekStart) return res.status(400).json({ message: "weekStart is required" });

    const weekEnd = toISODate(endOfWeekSunday(new Date(weekStart + "T00:00:00")));

    const entries = await TimeEntry.find({
      userId,
      date: { $gte: weekStart, $lte: weekEnd },
    });

    const totalSeconds = entries.reduce((s, e) => s + (e.durationSeconds || 0), 0);

    const sheet = await Timesheet.findOneAndUpdate(
      { userId, weekStart },
      {
        userId,
        weekStart,
        weekEnd,
        totalSeconds,
        status: "pending",
        submittedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await audit(req, {
      action: "UPDATE",
      entityType: "Timesheet",
      entityId: sheet._id,
      before: null,
      after: sheet.toObject(),
    });

    return res.json({ message: "Timesheet submitted", timesheet: sheet });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Approve / Reject timesheet (PM/Admin)
// -----------------------------------------------------------
exports.reviewTimesheet = async (req, res) => {
  try {
    if (!isAdmin(req) && !isPM(req)) {
      return res.status(403).json({ message: "Only admin/PM can review timesheets" });
    }

    const { action, comment } = req.body;
    if (!["approved", "rejected"].includes(action)) {
      return res.status(400).json({ message: "action must be approved or rejected" });
    }

    const sheet = await Timesheet.findById(req.params.id);
    if (!sheet) return res.status(404).json({ message: "Timesheet not found" });

    if (isPM(req)) {
      const pmProjects = await getPMProjectIds(req);

      const entries = await TimeEntry.find({
        userId: sheet.userId,
        date: { $gte: sheet.weekStart, $lte: sheet.weekEnd },
      }).select("projectId");

      const ok = entries.every((e) => pmProjects.includes(String(e.projectId)));
      if (!ok) return res.status(403).json({ message: "Not allowed to review this timesheet" });
    }

    const before = sheet.toObject();

    sheet.status = action;
    sheet.reviewedBy = req.user.id;
    sheet.reviewedAt = new Date();
    sheet.reviewComment = comment || "";

    await sheet.save();

    await audit(req, {
      action: "REVIEW",
      entityType: "Timesheet",
      entityId: sheet._id,
      before,
      after: sheet.toObject(),
    });

    return res.json({ message: `Timesheet ${action}`, timesheet: sheet });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Work Policy (Admin)
// -----------------------------------------------------------
exports.getWorkPolicy = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });

    let policy = await WorkPolicy.findOne({});
    if (!policy) policy = await WorkPolicy.create({ updatedBy: req.user.id });

    return res.json({ policy });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.updateWorkPolicy = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });

    let policy = await WorkPolicy.findOne({});
    const before = policy ? policy.toObject() : null;

    policy = await WorkPolicy.findOneAndUpdate(
      {},
      { ...req.body, updatedBy: req.user.id },
      { upsert: true, new: true }
    );

    await audit(req, {
      action: "POLICY_UPDATE",
      entityType: "WorkPolicy",
      entityId: policy._id,
      before,
      after: policy.toObject(),
    });

    return res.json({ message: "Work policy updated", policy });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// -----------------------------------------------------------
// ✅ Reports + Exports + Audit Logs (unchanged)
// -----------------------------------------------------------
exports.reportOrgSummary = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });

    const { from, to } = req.query;
    const q = {};
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = from;
      if (to) q.date.$lte = to;
    }

    const entries = await TimeEntry.find(q).select("userId projectId durationSeconds date");
    const totalSeconds = entries.reduce((s, e) => s + (e.durationSeconds || 0), 0);

    return res.json({
      from: from || null,
      to: to || null,
      totalSeconds,
      totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
      entryCount: entries.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.reportProjectSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { from, to } = req.query;

    if (!isAdmin(req)) {
      if (isPM(req)) {
        const pmProjects = await getPMProjectIds(req);
        if (!pmProjects.includes(String(projectId))) {
          return res.status(403).json({ message: "Not allowed project" });
        }
      }
    }

    const q = { projectId };
    if (!isAdmin(req) && !isPM(req)) q.userId = req.user.id;

    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = from;
      if (to) q.date.$lte = to;
    }

    const entries = await TimeEntry.find(q).select("durationSeconds userId date taskId");
    const totalSeconds = entries.reduce((s, e) => s + (e.durationSeconds || 0), 0);

    return res.json({
      projectId,
      totalSeconds,
      totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
      entryCount: entries.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.reportFlags = async (req, res) => {
  try {
    if (!isAdmin(req) && !isPM(req)) {
      return res.status(403).json({ message: "Admin/PM only" });
    }

    const policy = (await WorkPolicy.findOne({})) || {
      flagIfDailyHoursExceed: 12,
      flagIfMissingDays: 2,
    };

    const { from, to, userId } = req.query;

    const q = {};
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = from;
      if (to) q.date.$lte = to;
    }

    if (isAdmin(req) && userId) q.userId = userId;

    if (isPM(req)) {
      const pmProjects = await getPMProjectIds(req);
      q.projectId = { $in: pmProjects };
      if (userId) q.userId = userId;
    }

    const entries = await TimeEntry.find(q).select("userId date durationSeconds projectId");

    const daySum = new Map();
    for (const e of entries) {
      const k = `${e.userId}|${e.date}`;
      daySum.set(k, (daySum.get(k) || 0) + (e.durationSeconds || 0));
    }

    const excessive = [];
    const thresholdSec = Number(policy.flagIfDailyHoursExceed || 12) * 3600;

    for (const [k, sec] of daySum.entries()) {
      if (sec > thresholdSec) {
        const [uid, date] = k.split("|");
        excessive.push({
          userId: uid,
          date,
          hours: Math.round((sec / 3600) * 10) / 10,
        });
      }
    }

    return res.json({ excessiveDailyHours: excessive });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.exportEntriesCSV = async (req, res) => {
  try {
    const { from, to, userId } = req.query;

    const q = {};
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = from;
      if (to) q.date.$lte = to;
    }

    if (isAdmin(req)) {
      if (userId) q.userId = userId;
    } else if (isPM(req)) {
      const pmProjects = await getPMProjectIds(req);
      q.projectId = { $in: pmProjects };
      if (userId) q.userId = userId;
    } else {
      q.userId = req.user.id;
    }

    const entries = await TimeEntry.find(q)
      .populate("taskId", "title")
      .populate("projectId", "name")
      .sort({ date: 1 });

    const header = ["date", "project", "task", "durationSeconds", "notes", "status"].join(",");
    const rows = entries.map((e) => {
      const project = e.projectId?.name || "";
      const task = e.taskId?.title || "";
      return [
        csvEscape(e.date),
        csvEscape(project),
        csvEscape(task),
        csvEscape(e.durationSeconds),
        csvEscape(e.notes || ""),
        csvEscape(e.status || ""),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="time-entries.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.exportEntriesPDF = async (req, res) => {
  try {
    const { from, to, userId } = req.query;

    const q = {};
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = from;
      if (to) q.date.$lte = to;
    }

    if (isAdmin(req)) {
      if (userId) q.userId = userId;
    } else if (isPM(req)) {
      const pmProjects = await getPMProjectIds(req);
      q.projectId = { $in: pmProjects };
      if (userId) q.userId = userId;
    } else {
      q.userId = req.user.id;
    }

    const entries = await TimeEntry.find(q)
      .populate("taskId", "title")
      .populate("projectId", "name")
      .sort({ date: 1 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="time-entries.pdf"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).text("TaskFlow - Time Entries", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#666").text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fillColor("#000");
    doc.fontSize(11).text("Date | Project | Task | Seconds | Status", { underline: true });
    doc.moveDown(0.5);

    entries.forEach((e) => {
      const line = `${e.date} | ${e.projectId?.name || ""} | ${e.taskId?.title || ""} | ${e.durationSeconds} | ${e.status}`;
      doc.text(line);
    });

    doc.end();
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });

    const { entityType, actorId, limit = 50 } = req.query;
    const q = {};
    if (entityType) q.entityType = entityType;
    if (actorId) q.actorId = actorId;

    const logs = await AuditLog.find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200));

    return res.json({ logs });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
