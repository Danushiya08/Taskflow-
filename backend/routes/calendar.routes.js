// backend/routes/calendar.routes.js
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const calendarController = require("../controllers/calendarController");

router.get("/events", protect, calendarController.getEvents);
router.post("/events", protect, calendarController.createEvent);
router.get("/projects", protect, calendarController.getVisibleProjects);

module.exports = router;
