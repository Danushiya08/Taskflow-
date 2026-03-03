const mongoose = require("mongoose");

const ProjectMemberSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    roleInProject: {
      type: String,
      enum: ["project-manager", "team-member", "client"],
      required: true,
    },
  },
  { timestamps: true }
);

ProjectMemberSchema.index({ project: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("ProjectMember", ProjectMemberSchema);