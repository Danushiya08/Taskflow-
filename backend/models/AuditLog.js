const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      enum: ["CREATE", "UPDATE", "DELETE", "REVIEW", "POLICY_UPDATE"],
      required: true,
    },

    entityType: {
      type: String,
      enum: ["TimeEntry", "Timesheet", "WorkPolicy"],
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    before: { type: Object, default: null },
    after: { type: Object, default: null },

    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

// ✅ SAFE EXPORT (prevents OverwriteModelError)
module.exports =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
