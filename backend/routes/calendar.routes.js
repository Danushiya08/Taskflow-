// backend/routes/calendar.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const calendarController = require("../controllers/calendarController");

router.get("/events", authMiddleware, calendarController.getEvents);
router.post("/events", authMiddleware, calendarController.createEvent);
router.get("/projects", authMiddleware, calendarController.getVisibleProjects);

module.exports = router;
