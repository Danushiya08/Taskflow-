const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const budgetController = require("../controllers/budgetController");

router.get("/projects", protect, budgetController.getProjectBudgets);

router.get("/expenses", protect, budgetController.getExpenses);
router.post("/expenses", protect, budgetController.createExpense);

router.get("/analytics", protect, budgetController.getAnalytics);

// Export report (PDF)
router.get("/export", protect, budgetController.exportReport);

module.exports = router;

