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
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
