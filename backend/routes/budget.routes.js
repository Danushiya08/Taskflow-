const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const budgetController = require("../controllers/budgetController");

router.get("/projects", authMiddleware, budgetController.getProjectBudgets);

router.get("/expenses", authMiddleware, budgetController.getExpenses);
router.post("/expenses", authMiddleware, budgetController.createExpense);

router.get("/analytics", authMiddleware, budgetController.getAnalytics);

// Export report (PDF)
router.get("/export", authMiddleware, budgetController.exportReport);

module.exports = router;

