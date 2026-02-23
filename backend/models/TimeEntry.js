const mongoose = require("mongoose");

const timeEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },

    // store date as YYYY-MM-DD string (matches your controller logic)
    date: { type: String, required: true },

    durationSeconds: { type: Number, required: true, min: 1 },

    // Optional: timer info
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },

    notes: { type: String, default: "" },

    // ✅ manual entry support
    isManual: { type: Boolean, default: false },
    manualReason: { type: String, default: "" },

    // ✅ approval workflow
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending",
    },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, default: "" },

    // ✅ edit tracking (basic)
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastEditedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

timeEntrySchema.index({ userId: 1, date: 1 });
timeEntrySchema.index({ projectId: 1, date: 1 });
timeEntrySchema.index({ taskId: 1, date: 1 });
timeEntrySchema.index({ status: 1 });

module.exports = mongoose.model("TimeEntry", timeEntrySchema);
