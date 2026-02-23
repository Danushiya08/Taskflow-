const mongoose = require("mongoose");

const calendarEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    date: { type: Date, required: true }, // stored as Date
    time: { type: String, default: "" },  // "10:00"

    type: {
      type: String,
      enum: ["meeting", "deadline", "review", "planning", "presentation"],
      required: true,
    },

    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CalendarEvent", calendarEventSchema);