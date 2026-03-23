const Activity = require("../models/Activity");

const logActivity = async ({
  user,
  action,
  entityType,
  entityId = null,
  project = null,
  task = null,
  description,
  metadata = {},
}) => {
  try {
    if (!user || !action || !entityType || !description) return null;

    return await Activity.create({
      user,
      action,
      entityType,
      entityId,
      project,
      task,
      description,
      metadata,
    });
  } catch (err) {
    console.error("Activity log error:", err);
    return null;
  }
};

module.exports = { logActivity };