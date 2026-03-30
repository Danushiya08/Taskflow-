const Alert = require("../models/Alert");
const Project = require("../models/Project");
const Task = require("../models/Task");
const ProjectMember = require("../models/ProjectMember");

const normalizeDateOnly = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysBetween = (from, to) => {
  const ms = normalizeDateOnly(to) - normalizeDateOnly(from);
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const createAlertIfNotExists = async ({
  title,
  message,
  type,
  severity = "medium",
  user,
  project = null,
  task = null,
  document = null,
  meta = {},
}) => {
  const existing = await Alert.findOne({
    user,
    type,
    isRead: false,
    project: project || null,
    task: task || null,
    document: document || null,
  });

  if (existing) return null;

  return Alert.create({
    title,
    message,
    type,
    severity,
    user,
    project,
    task,
    document,
    meta,
  });
};

const getProjectManagerAndMembers = async (projectId) => {
  const members = await ProjectMember.find({ project: projectId }).populate(
    "user",
    "_id role"
  );

  return members.map((m) => m.user).filter(Boolean);
};

const runAlertChecks = async () => {
  const today = new Date();

  // -------------------------
  // TASK ALERTS
  // -------------------------
  const tasks = await Task.find({
    dueDate: { $ne: null },
  })
    .populate("projectId", "name dueDate progress status projectManager createdBy")
    .populate("assignedTo", "_id role name");

  for (const task of tasks) {
    const status = String(task.status || "").toLowerCase();
    const isCompleted = status === "done";

    if (isCompleted || !task.dueDate || !task.projectId) continue;

    const daysLeft = daysBetween(today, task.dueDate);
    const recipientIds = new Set();

    if (task.assignedTo?._id) {
      recipientIds.add(String(task.assignedTo._id));
    }

    if (task.projectId?.projectManager) {
      recipientIds.add(String(task.projectId.projectManager));
    }

    if (task.projectId?.createdBy) {
      recipientIds.add(String(task.projectId.createdBy));
    }

    const projectUsers = await getProjectManagerAndMembers(task.projectId._id);
    for (const u of projectUsers) {
      const role = String(u.role || "").toLowerCase();
      if (role === "admin" || role === "project-manager") {
        recipientIds.add(String(u._id));
      }
    }

    if (daysLeft < 0) {
      for (const userId of recipientIds) {
        await createAlertIfNotExists({
          title: "Task overdue",
          message: `Task "${task.title}" in project "${task.projectId.name}" is overdue.`,
          type: "task_overdue",
          severity: "high",
          user: userId,
          project: task.projectId._id,
          task: task._id,
          meta: { daysLate: Math.abs(daysLeft) },
        });
      }
    } else if (daysLeft <= 2) {
      for (const userId of recipientIds) {
        await createAlertIfNotExists({
          title: "Task due soon",
          message: `Task "${task.title}" in project "${task.projectId.name}" is due in ${daysLeft} day(s).`,
          type: "task_due_soon",
          severity: daysLeft === 0 ? "high" : "medium",
          user: userId,
          project: task.projectId._id,
          task: task._id,
          meta: { daysLeft },
        });
      }
    }
  }

  // -------------------------
  // PROJECT ALERTS
  // -------------------------
  const projects = await Project.find({
    dueDate: { $ne: null },
  }).populate("createdBy projectManager", "_id role name");

  for (const project of projects) {
    const progress = Number(project.progress || 0);
    const status = String(project.status || "").toLowerCase();
    const isCompleted = status === "completed" || progress >= 100;

    if (!project.dueDate || isCompleted) continue;

    const daysLeft = daysBetween(today, project.dueDate);
    const recipientIds = new Set();

    if (project.projectManager?._id) {
      recipientIds.add(String(project.projectManager._id));
    }

    if (project.createdBy?._id) {
      recipientIds.add(String(project.createdBy._id));
    }

    const projectUsers = await getProjectManagerAndMembers(project._id);
    for (const u of projectUsers) {
      const role = String(u.role || "").toLowerCase();
      if (role === "admin" || role === "project-manager" || role === "client") {
        recipientIds.add(String(u._id));
      }
    }

    if (daysLeft < 0) {
      for (const userId of recipientIds) {
        await createAlertIfNotExists({
          title: "Project overdue",
          message: `Project "${project.name}" is overdue and currently at ${progress}% progress.`,
          type: "project_overdue",
          severity: "high",
          user: userId,
          project: project._id,
          meta: { daysLate: Math.abs(daysLeft), progress },
        });
      }
    } else if (daysLeft <= 3) {
      for (const userId of recipientIds) {
        await createAlertIfNotExists({
          title: "Project due soon",
          message: `Project "${project.name}" is due in ${daysLeft} day(s). Current progress: ${progress}%.`,
          type: "project_due_soon",
          severity: progress < 70 ? "high" : "medium",
          user: userId,
          project: project._id,
          meta: { daysLeft, progress },
        });
      }
    }
  }

  return { message: "Alert checks completed" };
};

module.exports = {
  runAlertChecks,
};