const mongoose = require("mongoose");

const timesheetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    weekStart: { type: String, required: true }, // YYYY-MM-DD (Monday)
    weekEnd: { type: String, required: true },   // YYYY-MM-DD (Sunday)

    totalSeconds: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
    },

    submittedAt: { type: Date, default: null },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, default: "" },
  },
  { timestamps: true }
);

// prevent duplicate timesheets for the same user/week
timesheetSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model("Timesheet", timesheetSchema);
