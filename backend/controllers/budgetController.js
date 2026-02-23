const Project = require("../models/Project");
const Expense = require("../models/Expense");
const PDFDocument = require("pdfkit");

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

const userIdFromReq = (req) => String(req.user?.id || req.user?._id || "");

const requireAdminOrPM = (req, res) => {
  // Team Member + Client should NOT have budget option
  if (!isAdmin(req) && !isPM(req)) {
    res.status(403).json({ message: "Budget is only available for Admin and Project Manager roles" });
    return false;
  }
  return true;
};

/**
 * Must match your project.routes.js visibility logic
 */
const getProjectVisibilityFilter = (req) => {
  const userId = userIdFromReq(req);

  if (role(req) === "client") return { $or: [{ clientId: userId }, { client: userId }] };
  if (role(req) === "team-member") return { members: userId };
  if (role(req) === "project-manager") return { $or: [{ projectManager: userId }, { createdBy: userId }] };

  return {}; // admin sees all
};

const monthKey = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

// =====================================================
// GET /api/budget/projects
// Returns visible projects + budget + SPENT synced from expenses + breakdown by category
// =====================================================
exports.getProjectBudgets = async (req, res) => {
  try {
    if (!requireAdminOrPM(req, res)) return;

    const projFilter = getProjectVisibilityFilter(req);
    const projects = await Project.find(projFilter).select("_id name budget").sort({ createdAt: -1 });

    if (!projects.length) return res.json({ projects: [] });

    const projectIds = projects.map((p) => p._id);

    // aggregate spent totals per project
    const spentAgg = await Expense.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: "$projectId", totalSpent: { $sum: "$amount" } } },
    ]);

    const spentMap = new Map(spentAgg.map((x) => [String(x._id), Number(x.totalSpent || 0)]));

    // breakdown by category per project
    const breakdownAgg = await Expense.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: { projectId: "$projectId", category: "$category" }, total: { $sum: "$amount" } } },
    ]);

    const breakdownMap = new Map(); // projectId -> [{category, amount}]
    for (const row of breakdownAgg) {
      const pid = String(row._id.projectId);
      const cat = String(row._id.category || "Other");
      const amt = Number(row.total || 0);

      if (!breakdownMap.has(pid)) breakdownMap.set(pid, []);
      breakdownMap.get(pid).push({ category: cat, amount: amt });
    }

    const shaped = projects.map((p) => {
      const allocated = Number(p.budget?.allocated || 0);
      const spent = Number(spentMap.get(String(p._id)) || 0);

      const rawBreakdown = breakdownMap.get(String(p._id)) || [];
      const breakdown = rawBreakdown
        .sort((a, b) => b.amount - a.amount)
        .map((x) => ({
          category: x.category,
          amount: Math.round(x.amount),
          percentage: spent > 0 ? (x.amount / spent) * 100 : 0,
        }));

      return {
        _id: p._id,
        name: p.name,
        budget: { allocated, spent },
        breakdown,
      };
    });

    return res.json({ projects: shaped });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =====================================================
// GET /api/budget/expenses
// Recent expenses for visible projects (Admin/PM only)
// =====================================================
exports.getExpenses = async (req, res) => {
  try {
    if (!requireAdminOrPM(req, res)) return;

    const projFilter = getProjectVisibilityFilter(req);
    const visibleProjects = await Project.find(projFilter).select("_id name");
    const projectIds = visibleProjects.map((p) => p._id);

    if (projectIds.length === 0) return res.json({ expenses: [] });

    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const expenses = await Expense.find({ projectId: { $in: projectIds } })
      .populate("approvedBy", "name email role")
      .sort({ date: -1, createdAt: -1 })
      .limit(limit);

    const projectNameMap = new Map(visibleProjects.map((p) => [String(p._id), p.name]));

    const shaped = expenses.map((e) => ({
      _id: e._id,
      description: e.description,
      projectId: e.projectId,
      projectName: projectNameMap.get(String(e.projectId)) || "Project",
      category: e.category,
      amount: e.amount,
      date: e.date ? new Date(e.date).toISOString().slice(0, 10) : "",
      approvedByName: e.approvedBy?.name || "",
    }));

    return res.json({ expenses: shaped });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =====================================================
// POST /api/budget/expenses
// Create expense (Admin/PM only)
// Sync project.budget.spent + analytics + breakdown will update automatically
// =====================================================
exports.createExpense = async (req, res) => {
  try {
    if (!requireAdminOrPM(req, res)) return;

    const { projectId, description, category, amount, date } = req.body;

    if (!projectId) return res.status(400).json({ message: "projectId is required" });
    if (Number(amount) <= 0) return res.status(400).json({ message: "amount must be > 0" });

    //FUTURE-DATE VALIDATION (added)
    const expenseDate = date ? new Date(date) : new Date();
    if (expenseDate > new Date()) {
      return res.status(400).json({ message: "Expense date cannot be in the future" });
    }

    const projFilter = getProjectVisibilityFilter(req);
    const project = await Project.findOne({ ...projFilter, _id: projectId });
    if (!project) return res.status(404).json({ message: "Project not found or not allowed" });

    const created = await Expense.create({
      projectId,
      description: String(description || ""),
      category: String(category || "Other"),
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      approvedBy: userIdFromReq(req), // so "Approved by" shows in UI
      createdBy: userIdFromReq(req),
    });

    // keep Project.budget.spent updated too (even though UI uses aggregation)
    project.budget = project.budget || { allocated: 0, spent: 0 };
    project.budget.spent = Number(project.budget.spent || 0) + Number(created.amount || 0);
    await project.save();

    return res.status(201).json({ message: "Expense created", expense: created });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =====================================================
// GET /api/budget/analytics
// monthlySpending + categoryDistribution for visible projects (Admin/PM only)
// =====================================================
exports.getAnalytics = async (req, res) => {
  try {
    if (!requireAdminOrPM(req, res)) return;

    const projFilter = getProjectVisibilityFilter(req);
    const visibleProjects = await Project.find(projFilter).select("_id");
    const projectIds = visibleProjects.map((p) => p._id);

    if (projectIds.length === 0) {
      return res.json({ monthlySpending: [], categoryDistribution: [] });
    }

    const months = Math.min(Number(req.query.months) || 6, 24);

    const realNow = new Date();

    // Extend "now" if there are future-dated expenses (so charts still show them)
    const lastExpense = await Expense.findOne({ projectId: { $in: projectIds } })
      .sort({ date: -1, createdAt: -1 })
      .select("date createdAt");

    const maxDate = lastExpense?.date || lastExpense?.createdAt || realNow;
    const now = maxDate > realNow ? maxDate : realNow;

    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const expenses = await Expense.find({
      projectId: { $in: projectIds },
      $expr: {
        $and: [
          { $gte: [{ $ifNull: ["$date", "$createdAt"] }, start] },
          { $lte: [{ $ifNull: ["$date", "$createdAt"] }, now] },
        ],
      },
    }).select("amount category date createdAt");

    // monthly map
    const monthlyMap = new Map();
    for (const e of expenses) {
      const dt = e.date || e.createdAt;
      const k = monthKey(dt);
      monthlyMap.set(k, (monthlyMap.get(k) || 0) + Number(e.amount || 0));
    }

    const monthlySpending = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = monthKey(d);
      const label = d.toLocaleString("default", { month: "short" });
      monthlySpending.push({ month: label, amount: Math.round(monthlyMap.get(k) || 0) });
    }

    // category distribution
    const catMap = new Map();
    for (const e of expenses) {
      const c = String(e.category || "Other");
      catMap.set(c, (catMap.get(c) || 0) + Number(e.amount || 0));
    }

    const categoryDistribution = Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    return res.json({ monthlySpending, categoryDistribution });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// =====================================================
// GET /api/budget/export?format=pdf&months=12
// Downloads PDF of expenses for visible projects (Admin/PM only)
// =====================================================

exports.exportReport = async (req, res) => {
  try {
    if (!requireAdminOrPM(req, res)) return;

    const format = String(req.query.format || "pdf").toLowerCase();
    if (format !== "pdf") {
      return res.status(400).json({ message: "Only pdf export is supported now" });
    }

    const projFilter = getProjectVisibilityFilter(req);
    const visibleProjects = await Project.find(projFilter).select("_id name budget");
    const projectIds = visibleProjects.map((p) => p._id);

    const months = Math.min(Number(req.query.months) || 12, 48);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const projectNameMap = new Map(visibleProjects.map((p) => [String(p._id), p.name]));

    let expenses = [];
    if (projectIds.length) {
      expenses = await Expense.find({
        projectId: { $in: projectIds },
        date: { $gte: start, $lte: now },
      })
        .populate("approvedBy", "name")
        .sort({ date: -1, createdAt: -1 });
    }

    // Totals
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalBudget = visibleProjects.reduce((sum, p) => sum + Number(p.budget?.allocated || 0), 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const utilizationRate = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    // Create PDF stream
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="budget_report_${new Date().toISOString().slice(0, 10)}.pdf"`
    );

    doc.pipe(res);

    // ---- Header ----
    doc.fontSize(18).text("Budget Report", { align: "center" });
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor("#444").text(`Generated: ${now.toISOString().slice(0, 10)}`, { align: "center" });
    doc.text(`Period: last ${months} month(s)`, { align: "center" });

    doc.moveDown(1);
    doc.fillColor("#000");

    // ---- Summary Cards (simple text) ----
    doc.fontSize(12).text("Summary", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11).text(`Total Budget: $${Number(totalBudget).toLocaleString()}`);
    doc.text(`Total Spent: $${Number(totalSpent).toLocaleString()} (${utilizationRate}% utilized)`);
    doc.text(`Remaining: $${Number(totalRemaining).toLocaleString()}`);

    // At-risk count (over 90% used)
    const perProjectSpentMap = new Map();
    for (const e of expenses) {
      const pid = String(e.projectId);
      perProjectSpentMap.set(pid, (perProjectSpentMap.get(pid) || 0) + Number(e.amount || 0));
    }
    const atRiskCount = visibleProjects.filter((p) => {
      const allocated = Number(p.budget?.allocated || 0);
      const spent = Number(perProjectSpentMap.get(String(p._id)) || 0);
      return allocated > 0 && (spent / allocated) * 100 > 90;
    }).length;

    doc.text(`At Risk Projects (>90%): ${atRiskCount}`);

    doc.moveDown(1);

    // ---- Project Budgets Table ----
    doc.fontSize(12).text("Project Budgets", { underline: true });
    doc.moveDown(0.5);

    const startX = doc.x;
    let y = doc.y;

    const col = {
      project: startX,
      budget: startX + 230,
      spent: startX + 330,
      remaining: startX + 430,
    };

    const rowHeight = 18;

    const drawRow = (yy, pName, b, s, r) => {
      doc.fontSize(9).text(pName, col.project, yy, { width: 220 });
      doc.text(`$${Number(b).toLocaleString()}`, col.budget, yy, { width: 90, align: "right" });
      doc.text(`$${Number(s).toLocaleString()}`, col.spent, yy, { width: 90, align: "right" });
      doc.text(`$${Number(r).toLocaleString()}`, col.remaining, yy, { width: 90, align: "right" });
    };

    // header row
    doc.fontSize(9).fillColor("#000");
    doc.text("Project", col.project, y);
    doc.text("Budget", col.budget, y, { width: 90, align: "right" });
    doc.text("Spent", col.spent, y, { width: 90, align: "right" });
    doc.text("Remaining", col.remaining, y, { width: 90, align: "right" });
    y += rowHeight;

    doc.moveTo(startX, y - 6).lineTo(startX + 500, y - 6).strokeColor("#ddd").stroke();

    for (const p of visibleProjects) {
      const allocated = Number(p.budget?.allocated || 0);
      const spent = Number(perProjectSpentMap.get(String(p._id)) || 0);
      const remaining = Math.max(0, allocated - spent);

      if (y > 760) {
        doc.addPage();
        y = doc.y;
      }

      drawRow(y, p.name || "Project", allocated, spent, remaining);
      y += rowHeight;
    }

    doc.moveDown(1);
    doc.y = y + 10;

    // ---- Expenses Table ----
    doc.fontSize(12).text("Recent Expenses", { underline: true });
    doc.moveDown(0.5);

    y = doc.y;

    const eCol = {
      date: startX,
      project: startX + 70,
      category: startX + 250,
      amount: startX + 360,
      approved: startX + 450,
    };

    // header
    doc.fontSize(9);
    doc.text("Date", eCol.date, y);
    doc.text("Project", eCol.project, y, { width: 170 });
    doc.text("Category", eCol.category, y, { width: 100 });
    doc.text("Amount", eCol.amount, y, { width: 80, align: "right" });
    doc.text("Approved", eCol.approved, y, { width: 90 });
    y += rowHeight;

    doc.moveTo(startX, y - 6).lineTo(startX + 500, y - 6).strokeColor("#ddd").stroke();

    const maxRows = Math.min(expenses.length, 60); // prevent huge PDFs
    for (let i = 0; i < maxRows; i++) {
      const e = expenses[i];
      const date = e.date ? new Date(e.date).toISOString().slice(0, 10) : "";
      const projectName = projectNameMap.get(String(e.projectId)) || "Project";
      const category = String(e.category || "Other");
      const amount = Number(e.amount || 0);
      const approvedBy = e.approvedBy?.name || "-";

      if (y > 760) {
        doc.addPage();
        y = doc.y;
      }

      doc.fontSize(8);
      doc.text(date, eCol.date, y);
      doc.text(projectName, eCol.project, y, { width: 170 });
      doc.text(category, eCol.category, y, { width: 100 });
      doc.text(`$${amount.toLocaleString()}`, eCol.amount, y, { width: 80, align: "right" });
      doc.text(approvedBy, eCol.approved, y, { width: 90 });
      y += rowHeight;
    }

    if (expenses.length > maxRows) {
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor("#666").text(`Showing first ${maxRows} expenses (of ${expenses.length}).`);
      doc.fillColor("#000");
    }

    doc.end();
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
