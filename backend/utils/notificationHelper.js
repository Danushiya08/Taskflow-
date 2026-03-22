const Notification = require("../models/Notification");
const Project = require("../models/Project");
const ProjectMember = require("../models/ProjectMember");

const normalizeRole = (role) => {
  const r = String(role || "").trim().toLowerCase();

  if (r === "admin") return "admin";
  if (["project-manager", "projectmanager", "project manager", "pm"].includes(r)) {
    return "project-manager";
  }
  if (["team-member", "teammember", "team member", "member"].includes(r)) {
    return "team-member";
  }
  if (r === "client") return "client";

  return r;
};

const uniqueIds = (values = []) => {
  return [...new Set(values.map((v) => String(v)).filter(Boolean))];
};

const getProjectStakeholders = async (projectId) => {
  if (!projectId) {
    return {
      adminIds: [],
      projectManagerIds: [],
      teamMemberIds: [],
      clientIds: [],
      allUserIds: [],
    };
  }

  const project = await Project.findById(projectId)
    .select("projectManager members client createdBy")
    .lean();

  const memberships = await ProjectMember.find({ project: projectId })
    .populate("user", "_id role")
    .lean();

  const adminIds = [];
  const projectManagerIds = [];
  const teamMemberIds = [];
  const clientIds = [];

  if (project?.projectManager) {
    projectManagerIds.push(String(project.projectManager));
  }

  if (Array.isArray(project?.members)) {
    for (const memberId of project.members) {
      teamMemberIds.push(String(memberId));
    }
  }

  if (project?.client) {
    clientIds.push(String(project.client));
  }

  for (const membership of memberships) {
    const userId = membership?.user?._id ? String(membership.user._id) : String(membership?.user);
    const role = normalizeRole(membership?.role || membership?.user?.role);

    if (!userId) continue;

    if (role === "admin") adminIds.push(userId);
    else if (role === "project-manager") projectManagerIds.push(userId);
    else if (role === "team-member") teamMemberIds.push(userId);
    else if (role === "client") clientIds.push(userId);
  }

  return {
    adminIds: uniqueIds(adminIds),
    projectManagerIds: uniqueIds(projectManagerIds),
    teamMemberIds: uniqueIds(teamMemberIds),
    clientIds: uniqueIds(clientIds),
    allUserIds: uniqueIds([
      ...adminIds,
      ...projectManagerIds,
      ...teamMemberIds,
      ...clientIds,
    ]),
  };
};

const createNotificationsForUsers = async ({
  userIds = [],
  type,
  title,
  message,
  relatedProject = null,
  relatedTask = null,
}) => {
  const recipients = uniqueIds(userIds);

  if (!recipients.length) return [];

  const docs = recipients.map((userId) => ({
    user: userId,
    type,
    title,
    message,
    relatedProject,
    relatedTask,
  }));

  return Notification.insertMany(docs);
};

const notifyByRoles = async ({
  projectId,
  roles = [],
  type,
  title,
  message,
  relatedProject = null,
  relatedTask = null,
  excludeUserIds = [],
}) => {
  const stakeholders = await getProjectStakeholders(projectId);

  let userIds = [];

  for (const role of roles.map(normalizeRole)) {
    if (role === "admin") userIds.push(...stakeholders.adminIds);
    if (role === "project-manager") userIds.push(...stakeholders.projectManagerIds);
    if (role === "team-member") userIds.push(...stakeholders.teamMemberIds);
    if (role === "client") userIds.push(...stakeholders.clientIds);
    if (role === "all") userIds.push(...stakeholders.allUserIds);
  }

  const excluded = new Set(excludeUserIds.map(String));
  userIds = uniqueIds(userIds).filter((id) => !excluded.has(String(id)));

  return createNotificationsForUsers({
    userIds,
    type,
    title,
    message,
    relatedProject,
    relatedTask,
  });
};

module.exports = {
  normalizeRole,
  getProjectStakeholders,
  createNotificationsForUsers,
  notifyByRoles,
};