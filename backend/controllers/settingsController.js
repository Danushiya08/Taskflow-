const bcrypt = require("bcryptjs");
const User = require("../models/User");

const buildSettingsResponse = (user) => {
  return {
    profile: {
      name: user.name || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      jobTitle: user.jobTitle || "",
      department: user.department || "",
      bio: user.bio || "",
      avatar: user.avatar || "",
      role: user.role || "",
    },
    notifications: {
      emailNotifications: user.notificationSettings?.emailNotifications ?? true,
      pushNotifications: user.notificationSettings?.pushNotifications ?? true,
      taskUpdates: user.notificationSettings?.taskUpdates ?? true,
      projectMilestones: user.notificationSettings?.projectMilestones ?? true,
      teamMentions: user.notificationSettings?.teamMentions ?? true,
      weeklyReports: user.notificationSettings?.weeklyReports ?? false,
    },
    preferences: {
      language: user.preferences?.language || "en",
      timezone: user.preferences?.timezone || "gmt",
      dateFormat: user.preferences?.dateFormat || "mdy",
      theme: user.preferences?.theme || "light",
      currency: user.preferences?.currency || "USD",
      defaultProjectView: user.preferences?.defaultProjectView || "kanban",
      compactMode: user.preferences?.compactMode ?? false,
      showCompletedTasks: user.preferences?.showCompletedTasks ?? true,
    },
    security: {
      twoFactorEnabled: user.twoFactorEnabled ?? false,
    },
  };
};

exports.getMySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(buildSettingsResponse(user));
  } catch (error) {
    console.error("getMySettings error:", error);
    return res.status(500).json({ message: "Failed to fetch settings" });
  }
};

exports.updateProfileSettings = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, jobTitle, department, bio, avatar } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: user._id },
      });

      if (existingEmail) {
        return res.status(400).json({ message: "Email is already in use" });
      }

      user.email = email.toLowerCase();
    }

    user.firstName = firstName ?? user.firstName;
    user.lastName = lastName ?? user.lastName;
    user.phone = phone ?? user.phone;
    user.jobTitle = jobTitle ?? user.jobTitle;
    user.department = department ?? user.department;
    user.bio = bio ?? user.bio;
    user.avatar = avatar ?? user.avatar;

    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    if (fullName) {
      user.name = fullName;
    }

    await user.save();

    return res.status(200).json({
      message: "Profile settings updated successfully",
      profile: buildSettingsResponse(user).profile,
    });
  } catch (error) {
    console.error("updateProfileSettings error:", error);
    return res.status(500).json({ message: "Failed to update profile settings" });
  }
};

exports.updateNotificationSettings = async (req, res) => {
  try {
    const {
      emailNotifications,
      pushNotifications,
      taskUpdates,
      projectMilestones,
      teamMentions,
      weeklyReports,
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "notificationSettings.emailNotifications": emailNotifications,
          "notificationSettings.pushNotifications": pushNotifications,
          "notificationSettings.taskUpdates": taskUpdates,
          "notificationSettings.projectMilestones": projectMilestones,
          "notificationSettings.teamMentions": teamMentions,
          "notificationSettings.weeklyReports": weeklyReports,
        },
      },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Notification settings updated successfully",
      notifications: buildSettingsResponse(user).notifications,
    });
  } catch (error) {
    console.error("updateNotificationSettings error:", error);
    return res.status(500).json({ message: "Failed to update notification settings" });
  }
};

exports.updatePreferenceSettings = async (req, res) => {
  try {
    const {
      language,
      timezone,
      dateFormat,
      theme,
      currency,
      defaultProjectView,
      compactMode,
      showCompletedTasks,
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "preferences.language": language,
          "preferences.timezone": timezone,
          "preferences.dateFormat": dateFormat,
          "preferences.theme": theme,
          "preferences.currency": currency,
          "preferences.defaultProjectView": defaultProjectView,
          "preferences.compactMode": compactMode,
          "preferences.showCompletedTasks": showCompletedTasks,
        },
      },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Preferences updated successfully",
      preferences: buildSettingsResponse(user).preferences,
    });
  } catch (error) {
    console.error("updatePreferenceSettings error:", error);
    return res.status(500).json({ message: "Failed to update preferences" });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All password fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("updatePassword error:", error);
    return res.status(500).json({ message: "Failed to update password" });
  }
};

exports.toggleTwoFactor = async (req, res) => {
  try {
    const { enabled } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { twoFactorEnabled: !!enabled } },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: `Two-factor authentication ${enabled ? "enabled" : "disabled"} successfully`,
      security: buildSettingsResponse(user).security,
    });
  } catch (error) {
    console.error("toggleTwoFactor error:", error);
    return res.status(500).json({ message: "Failed to update 2FA setting" });
  }
};