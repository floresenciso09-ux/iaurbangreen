const rateLimit = require("express-rate-limit");

const windowMs =
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const maxGlobal =
  Number(process.env.RATE_LIMIT_MAX) || 500;
const maxClassify =
  Number(process.env.RATE_LIMIT_CLASSIFY_MAX) || 30;
const maxInsights =
  Number(process.env.RATE_LIMIT_INSIGHTS_MAX) || 25;
const maxGeminiTest =
  Number(process.env.RATE_LIMIT_GEMINI_TEST_MAX) || 15;
const maxAiPlantCare =
  Number(process.env.RATE_LIMIT_AI_PLANT_CARE_MAX) || 40;
const maxAiPredict =
  Number(process.env.RATE_LIMIT_AI_PREDICT_MAX) || 60;
const maxAiDiagnosis =
  Number(process.env.RATE_LIMIT_AI_DIAGNOSIS_MAX) || 20;

/**
 * Limite general por IP (todas las rutas salvo las que se salten abajo).
 */
const apiLimiter = rateLimit({
  windowMs,
  max: maxGlobal,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  message: {
    error: "Too many requests",
    details:
      "Has superado el límite de peticiones por IP. Espera unos minutos e intenta de nuevo.",
  },
});

/**
 * Limite mas estricto para clasificacion de plantas (coste de API externa).
 */
const classifyLimiter = rateLimit({
  windowMs,
  max: maxClassify,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many classification requests",
    details:
      "Demasiados intentos de identificación desde esta IP. Prueba más tarde.",
  },
});

/**
 * Límite para notas IA por planta (coste OpenAI).
 */
const insightsLimiter = rateLimit({
  windowMs,
  max: maxInsights,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many insight requests",
    details:
      "Demasiadas solicitudes de información IA desde esta IP. Prueba más tarde.",
  },
});

/** POST /plants/gemini-test (pruebas Postman; coste API). */
const geminiTestLimiter = rateLimit({
  windowMs,
  max: maxGeminiTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many Gemini test requests",
    details:
      "Demasiadas pruebas de Gemini desde esta IP. Prueba más tarde.",
  },
});

const aiPlantCareLimiter = rateLimit({
  windowMs,
  max: maxAiPlantCare,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many AI plant-care requests",
    details: "Demasiadas solicitudes a /ai/plant-care. Prueba más tarde.",
  },
});

const aiPredictLimiter = rateLimit({
  windowMs,
  max: maxAiPredict,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many predict-watering requests",
    details: "Demasiadas predicciones. Prueba más tarde.",
  },
});

const aiDiagnosisLimiter = rateLimit({
  windowMs,
  max: maxAiDiagnosis,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many diagnosis requests",
    details: "Demasiados diagnósticos avanzados. Prueba más tarde.",
  },
});

module.exports = {
  apiLimiter,
  classifyLimiter,
  insightsLimiter,
  geminiTestLimiter,
  aiPlantCareLimiter,
  aiPredictLimiter,
  aiDiagnosisLimiter,
};
