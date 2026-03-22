const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "project-manager", "team-member", "client"],
      default: "team-member",
    },

    // Profile fields
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    jobTitle: { type: String, trim: true, default: "" },
    department: {
      type: String,
      enum: ["", "engineering", "design", "marketing", "sales", "operations"],
      default: "",
    },
    bio: { type: String, trim: true, default: "" },
    avatar: { type: String, default: "" },

    // Notification settings
    notificationSettings: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      taskUpdates: { type: Boolean, default: true },
      projectMilestones: { type: Boolean, default: true },
      teamMentions: { type: Boolean, default: true },
      weeklyReports: { type: Boolean, default: false },
    },

    // Preferences
    preferences: {
      language: {
        type: String,
        enum: ["en", "ta", "si", "es", "fr"],
        default: "en",
      },
      timezone: {
        type: String,
        enum: [
          "gmt",
          "UTC",
          "Asia/Colombo",
          "Asia/Kolkata",
          "Europe/London",
          "America/New_York",
          "America/Los_Angeles",
        ],
        default: "gmt",
      },
      dateFormat: {
        type: String,
        enum: ["mdy", "dmy", "ymd"],
        default: "mdy",
      },
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "light",
      },
      currency: {
        type: String,
        enum: ["USD", "GBP", "LKR", "EUR"],
        default: "USD",
      },
      defaultProjectView: {
        type: String,
        enum: ["kanban", "list", "calendar", "timeline"],
        default: "kanban",
      },
      compactMode: { type: Boolean, default: false },
      showCompletedTasks: { type: Boolean, default: true },
    },

    // Security
    twoFactorEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);