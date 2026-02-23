const mongoose = require("mongoose");

const workPolicySchema = new mongoose.Schema(
  {
    name: { type: String, default: "Default Policy" },

    // For overtime calculations
    dailyHours: { type: Number, default: 8 }, // expected per day
    weeklyHours: { type: Number, default: 40 }, // expected per week
    overtimeAfterDailyHours: { type: Number, default: 8 },

    // Flagging thresholds
    flagIfDailyHoursExceed: { type: Number, default: 12 },
    flagIfMissingDays: { type: Number, default: 2 }, // missing days within range

    timezone: { type: String, default: "Asia/Colombo" },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// ✅ SAFE EXPORT (prevents OverwriteModelError)
module.exports =
  mongoose.models.WorkPolicy || mongoose.model("WorkPolicy", workPolicySchema);
