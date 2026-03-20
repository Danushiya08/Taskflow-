const Risk = require("../models/risk");
const Project = require("../models/Project");

const probabilityScores = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const impactScores = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const getRiskScore = (probability, impact) => {
  return (probabilityScores[probability] || 0) * (impactScores[impact] || 0);
};

// =============================
// GET PROJECTS FOR RISK DROPDOWN
// =============================
exports.getProjectsForRisk = async (req, res) => {
  try {
    const projects = await Project.find({ archived: false })
      .select("_id name")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
      error: error.message,
    });
  }
};

// =============================
// GET ALL RISKS
// =============================
exports.getRisks = async (req, res) => {
  try {
    const { search = "", status, probability, impact } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { project: { $regex: search, $options: "i" } },
        { owner: { $regex: search, $options: "i" } },
      ];
    }

    if (status) query.status = status.toLowerCase();
    if (probability) query.probability = probability.toLowerCase();
    if (impact) query.impact = impact.toLowerCase();

    const risks = await Risk.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    const risksWithScore = risks.map((risk) => {
      const r = risk.toObject();
      r.riskScore = getRiskScore(risk.probability, risk.impact);
      return r;
    });

    res.status(200).json({
      success: true,
      count: risksWithScore.length,
      data: risksWithScore,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch risks",
      error: error.message,
    });
  }
};

// =============================
// GET SINGLE RISK
// =============================
exports.getRiskById = async (req, res) => {
  try {
    const risk = await Risk.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!risk) {
      return res.status(404).json({
        success: false,
        message: "Risk not found",
      });
    }

    const r = risk.toObject();
    r.riskScore = getRiskScore(risk.probability, risk.impact);

    res.status(200).json({
      success: true,
      data: r,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch risk",
      error: error.message,
    });
  }
};

// =============================
// CREATE RISK
// =============================
exports.createRisk = async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      probability,
      impact,
      status,
      mitigation,
      owner,
      identifiedDate,
    } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project is required",
      });
    }

    const selectedProject = await Project.findById(projectId).select("_id name");

    if (!selectedProject) {
      return res.status(404).json({
        success: false,
        message: "Selected project not found",
      });
    }

    const risk = await Risk.create({
      title,
      description,
      project: selectedProject.name,
      projectId: selectedProject._id,
      probability,
      impact,
      status: status || "active",
      mitigation,
      owner,
      identifiedDate: identifiedDate || new Date(),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const createdRisk = await Risk.findById(risk._id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    const r = createdRisk.toObject();
    r.riskScore = getRiskScore(r.probability, r.impact);

    res.status(201).json({
      success: true,
      message: "Risk created successfully",
      data: r,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create risk",
      error: error.message,
    });
  }
};

// =============================
// UPDATE RISK
// =============================
exports.updateRisk = async (req, res) => {
  try {
    const risk = await Risk.findById(req.params.id);

    if (!risk) {
      return res.status(404).json({
        success: false,
        message: "Risk not found",
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user._id,
    };

    if (req.body.projectId) {
      const selectedProject = await Project.findById(req.body.projectId).select("_id name");

      if (!selectedProject) {
        return res.status(404).json({
          success: false,
          message: "Selected project not found",
        });
      }

      updateData.project = selectedProject.name;
      updateData.projectId = selectedProject._id;
    }

    const updated = await Risk.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    const r = updated.toObject();
    r.riskScore = getRiskScore(r.probability, r.impact);

    res.status(200).json({
      success: true,
      message: "Risk updated",
      data: r,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update risk",
      error: error.message,
    });
  }
};

// =============================
// DELETE RISK
// =============================
exports.deleteRisk = async (req, res) => {
  try {
    const risk = await Risk.findById(req.params.id);

    if (!risk) {
      return res.status(404).json({
        success: false,
        message: "Risk not found",
      });
    }

    await Risk.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Risk deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete risk",
      error: error.message,
    });
  }
};

// =============================
// GET RISK STATS
// =============================
exports.getRiskStats = async (req, res) => {
  try {
    const risks = await Risk.find();

    const stats = {
      total: risks.length,
      critical: 0,
      high: 0,
      mitigated: 0,
      heatMap: {
        high: { low: 0, medium: 0, high: 0 },
        medium: { low: 0, medium: 0, high: 0 },
        low: { low: 0, medium: 0, high: 0 },
      },
    };

    risks.forEach((risk) => {
      const score = getRiskScore(risk.probability, risk.impact);

      if (score >= 9) stats.critical += 1;
      if (score >= 6 && score < 9) stats.high += 1;
      if (risk.status === "mitigated") stats.mitigated += 1;

      const probKey =
        risk.probability === "critical" || risk.probability === "high"
          ? "high"
          : risk.probability === "medium"
          ? "medium"
          : "low";

      const impactKey =
        risk.impact === "critical" || risk.impact === "high"
          ? "high"
          : risk.impact === "medium"
          ? "medium"
          : "low";

      stats.heatMap[probKey][impactKey] += 1;
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      error: error.message,
    });
  }
};