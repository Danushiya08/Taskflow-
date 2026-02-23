const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    status: {
      type: String,
      enum: ["planning", "active", "on-hold", "completed"],
      default: "planning",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    // who created it
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // optional assignments
    projectManager: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // NEW: client mapping 
    client: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    budget: {
      allocated: { type: Number, default: 0 },
      spent: { type: Number, default: 0 },
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    dueDate: { type: Date, default: null },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Project || mongoose.model("Project", projectSchema);
