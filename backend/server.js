const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const testRoutes = require("./routes/testRoutes");
const meRoutes = require("./routes/me.routes");
const projectRoutes = require("./routes/project.routes");
const userRoutes = require("./routes/users.routes");
const taskRoutes = require("./routes/task.routes");
const teamRoutes = require("./routes/team.routes");
const timeTrackingRoutes = require("./routes/timeTracking.routes");
const reportsRoutes = require("./routes/reports.routes");
const budgetRoutes = require("./routes/budget.routes");
const calendarRoutes = require("./routes/calendar.routes");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

app.get("/", (req, res) => {
  res.send("TaskFlow Backend is running 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api", meRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/users", userRoutes);
app.use("/api", taskRoutes);
app.use("/api/team", teamRoutes);
app.use("/api", timeTrackingRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/calendar", calendarRoutes);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
  });