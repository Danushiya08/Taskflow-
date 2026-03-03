const mongoose = require("mongoose");

const DocumentVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true }, // 1,2,3...
    fileUrl: { type: String, required: true }, // local path or S3 URL
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, default: Date.now },
    changeNote: { type: String, default: "" },
  },
  { _id: false }
);

const DocumentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true }, // display name
    description: { type: String, default: "" },

    visibility: { type: String, enum: ["internal", "client"], default: "internal" },
    status: { type: String, enum: ["draft", "in-review", "approved"], default: "draft" },

    versions: { type: [DocumentVersionSchema], default: [] },
    currentVersion: { type: Number, default: 1 },

    // explicit shares (optional - good for finer access)
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

DocumentSchema.index({ project: 1, title: 1 });

module.exports = mongoose.model("Document", DocumentSchema);