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

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://your-frontend-domain.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
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

// make socket available in controllers/routes/helpers
app.set("io", io);

/**
 * Railway / proxies:
 * Ensures req.ip is correct (important for rate limiting)
 */
app.set("trust proxy", 1);

/**
 * Rate limiting (basic protection)
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // adjust as needed
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.use(limiter);

/**
 * CORS (keep as-is for now, but you can lock it later)
 */
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

/**
 * Body parsing (add simple safety limits)
 */
app.use(express.json({ limit: "1mb" }));

/**
 * Request logger (keep your logger)
 */
app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

/**
 * Root route
 */
app.get("/", (req, res) => {
  res.send("TaskFlow Backend is running 🚀");
});

/**
 * Health check (enterprise standard)
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Routes
 */
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

/**
 * 404 handler (for unknown routes)
 */
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

/**
 * Global error handler (must be last)
 */
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    /**
     * Smart Alerts Cron Job
     * TEST MODE: runs every minute
     * Later change to: "0 8 * * *" for every day at 8 AM
     */
    cron.schedule("* * * * *", async () => {
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