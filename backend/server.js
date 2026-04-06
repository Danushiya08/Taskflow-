const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const http = require("http");
const { Server } = require("socket.io");
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
const documentsRoutes = require("./routes/documents.routes");
const cloudRoutes = require("./routes/cloud.routes");
const projectRolesRoutes = require("./routes/projectRoles.routes");
const riskRoutes = require("./routes/risk.routes");
const settingsRoutes = require("./routes/settings.routes");
const activityRoutes = require("./routes/activity.routes");
const notificationRoutes = require("./routes/notification.routes");
const alertsRoutes = require("./routes/alerts.routes");
const { runAlertChecks } = require("./utils/alertHelper");

const app = express();
const server = http.createServer(app);
server.setTimeout(30000);

const corsOptions = {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(server, {
  cors: corsOptions,
});

// store connected users
const userSocketMap = {};

/**
 * Socket connection
 */
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("register", (userId) => {
    if (!userId) return;

    const room = String(userId);
    socket.join(room);

    console.log("📩 Register event received:", userId);
    console.log("✅ User joined room:", room, "socket:", socket.id);
  });

  socket.on("call-user", ({ to, from, signal }) => {
    if (!to || !from || !signal) return;

    io.to(String(to)).emit("incoming-call", {
      from,
      signal,
    });

    console.log("📞 Call request sent from", from, "to", to);
  });

  socket.on("answer-call", ({ to, signal }) => {
    if (!to || !signal) return;

    io.to(String(to)).emit("call-accepted", {
      signal,
    });

    console.log("✅ Call answered for", to);
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    if (!to || !candidate) return;

    io.to(String(to)).emit("ice-candidate", {
      candidate,
    });

    console.log("🧊 ICE candidate sent to", to);
  });

  socket.on("end-call", ({ to, from }) => {
    if (!to) return;

    io.to(String(to)).emit("call-ended", {
      from: from || null,
    });

    console.log("❌ Call ended by", from, "for", to);
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

app.set("io", io);

app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
  skip: (req) => process.env.NODE_ENV !== "production",
});
app.use(limiter);

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

app.get("/", (req, res) => {
  res.send("TaskFlow Backend is running 🚀");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
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
app.use("/uploads", require("express").static("uploads"));
app.use("/api", documentsRoutes);
app.use("/api", cloudRoutes);
app.use("/api", projectRolesRoutes);
app.use("/api/risks", riskRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api", alertsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connection established");
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("🔄 MongoDB reconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err.message);
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    cron.schedule("0 8 * * *", async () => {
      console.log("⏰ Running alert checks...");
      try {
        await runAlertChecks();
        console.log("✅ Alert checks completed");
      } catch (err) {
        console.error("❌ Alert cron failed:", err.message);
      }
    });

    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
  });