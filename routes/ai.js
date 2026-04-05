const express = require("express");
const { optionalAuth } = require("../middleware/optionalAuth");
const { requireAuth } = require("../middleware/requireAuth");
const { requirePremium } = require("../middleware/premium");
const {
  aiPlantCareLimiter,
  aiPredictLimiter,
  aiDiagnosisLimiter,
} = require("../middleware/rateLimit");
const {
  validatePlantCarePayload,
  validatePredictWateringPayload,
  validateAdvancedDiagnosisPayload,
} = require("../utils/validatePlantCarePayload");
const {
  runPlantCare,
  runAdvancedDiagnosis,
  predictWatering,
} = require("../services/aiPlantCareService");

const router = express.Router();

/**
 * POST /ai/plant-care
 * Opcional: Authorization Bearer. El tier premium solo si el JWT corresponde a usuario con suscripción activa.
 * El campo `premium` en el body se ignora (no otorga premium); sin JWT premium la respuesta es tier free.
 */
router.post("/plant-care", aiPlantCareLimiter, optionalAuth, async (req, res) => {
  try {
    const checked = validatePlantCarePayload(req.body);
    if (!checked.ok) {
      return res.status(checked.status).json({ error: checked.error, code: "INVALID_PAYLOAD" });
    }

    const result = await runPlantCare(req.body, {
      isPremium: Boolean(req.authIsPremium),
      language: checked.language,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("POST /ai/plant-care error:", error);
    return res.status(500).json({ error: "No se pudo generar el plan de cuidado." });
  }
});

router.post("/predict-watering", aiPredictLimiter, async (req, res) => {
  try {
    const checked = validatePredictWateringPayload(req.body);
    if (!checked.ok) {
      return res.status(checked.status).json({ error: checked.error, code: "INVALID_PAYLOAD" });
    }
    const out = predictWatering(checked.history);
    return res.status(200).json({
      species: checked.species,
      ...out,
    });
  } catch (error) {
    console.error("POST /ai/predict-watering error:", error);
    return res.status(500).json({ error: "Error en la predicción." });
  }
});

router.post(
  "/advanced-diagnosis",
  aiDiagnosisLimiter,
  requireAuth,
  requirePremium,
  async (req, res) => {
    try {
      const checked = validateAdvancedDiagnosisPayload(req.body);
      if (!checked.ok) {
        return res.status(checked.status).json({ error: checked.error, code: "INVALID_PAYLOAD" });
      }
      const diagnosis = await runAdvancedDiagnosis({
        species: checked.species,
        symptoms: checked.symptoms,
        notes: checked.notes ?? null,
        language: checked.language,
      });
      return res.status(200).json({ diagnosis });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode === 400) {
        return res.status(400).json({ error: error.message, code: "INVALID_PAYLOAD" });
      }
      if (statusCode === 503 || statusCode === 502 || statusCode === 429 || statusCode === 504) {
        return res.status(statusCode).json({
          error: error.message || "IA no disponible.",
          code: error.code || "AI_UNAVAILABLE",
        });
      }
      console.error("POST /ai/advanced-diagnosis error:", error);
      return res.status(500).json({ error: "No se pudo generar el diagnóstico." });
    }
  }
);

module.exports = router;
