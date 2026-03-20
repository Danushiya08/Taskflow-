const mongoose = require("mongoose");

const riskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Risk title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Risk description is required"],
      trim: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: false,
    },

    project: {
      type: String,
      required: [true, "Project is required"],
      trim: true,
    },

    probability: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      lowercase: true,
    },
    impact: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["active", "monitoring", "mitigated"],
      default: "active",
      lowercase: true,
    },
    mitigation: {
      type: String,
      required: [true, "Mitigation strategy is required"],
      trim: true,
    },
    owner: {
      type: String,
      required: [true, "Risk owner is required"],
      trim: true,
    },
    identifiedDate: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Risk", riskSchema);