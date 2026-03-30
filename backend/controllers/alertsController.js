const Alert = require("../models/Alert");

const getAllowedTypesByRole = (role) => {
  const normalizedRole = String(role || "").toLowerCase().trim();

  if (normalizedRole === "admin") {
    return null; // all alert types
  }

  if (
    normalizedRole === "project-manager" 
    )
   {
    return [
      "task_overdue",
      "task_due_soon",
      "project_overdue",
      "project_due_soon",
      "budget_warning",
      "document_pending_review",
    ];
  }

  if (
    normalizedRole === "team-member" 
  ) {
    return ["task_overdue", "task_due_soon"];
  }

  if (normalizedRole === "client") {
    return ["project_overdue", "project_due_soon"];
  }

  return [];
};

const getMyAlerts = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const roleFromQuery = req.query.role;
    const role = roleFromQuery || req.user.role;

    const allowedTypes = getAllowedTypesByRole(role);

    const query = {
      user: userId,
    };

    if (Array.isArray(allowedTypes)) {
      query.type = { $in: allowedTypes };
    }

    const alerts = await Alert.find(query)
      .populate("project", "name status dueDate progress")
      .populate("task", "title status dueDate priority")
      .sort({ createdAt: -1 });

    res.json(alerts);
  } catch (error) {
    console.error("getMyAlerts error:", error);
    res.status(500).json({ message: "Failed to load alerts" });
  }
};

const getUnreadAlertCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const roleFromQuery = req.query.role;
    const role = roleFromQuery || req.user.role;

    const allowedTypes = getAllowedTypesByRole(role);

    const query = {
      user: userId,
      isRead: false,
    };

    if (Array.isArray(allowedTypes)) {
      query.type = { $in: allowedTypes };
    }

    const count = await Alert.countDocuments(query);

    res.json({ count });
  } catch (error) {
    console.error("getUnreadAlertCount error:", error);
    res.status(500).json({ message: "Failed to load unread alert count" });
  }
};

const markAlertAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const alert = await Alert.findOneAndUpdate(
      {
        _id: req.params.id,
        user: userId,
      },
      { isRead: true },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    res.json(alert);
  } catch (error) {
    console.error("markAlertAsRead error:", error);
    res.status(500).json({ message: "Failed to update alert" });
  }
};

const markAllAlertsAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const roleFromQuery = req.query.role;
    const role = roleFromQuery || req.user.role;

    const allowedTypes = getAllowedTypesByRole(role);

    const query = {
      user: userId,
      isRead: false,
    };

    if (Array.isArray(allowedTypes)) {
      query.type = { $in: allowedTypes };
    }

    await Alert.updateMany(query, { isRead: true });

    res.json({ message: "All alerts marked as read" });
  } catch (error) {
    console.error("markAllAlertsAsRead error:", error);
    res.status(500).json({ message: "Failed to update alerts" });
  }
};

module.exports = {
  getMyAlerts,
  getUnreadAlertCount,
  markAlertAsRead,
  markAllAlertsAsRead,
};