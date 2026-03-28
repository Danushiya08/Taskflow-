const mongoose = require("mongoose");
const Notification = require("../models/Notification");

const getUserId = (user) => String(user?._id || user?.id || "");

const getNotifications = async (req, res) => {
  try {
    const userId = getUserId(req.user);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notifications = await Notification.find({ user: userId })
      .populate("relatedProject", "name")
      .populate("relatedTask", "title status dueDate")
      .sort({ createdAt: -1 });

    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    return res.status(200).json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req.user);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid notification id" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { isRead: true },
      { new: true }
    )
      .populate("relatedProject", "name")
      .populate("relatedTask", "title status dueDate");

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    return res.status(500).json({ message: "Failed to update notification" });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = getUserId(req.user);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    return res.status(500).json({ message: "Failed to update notifications" });
  }
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};