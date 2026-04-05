const { resolveProvider } = require("./plantInsights");
const {
  evaluateEnvironment,
  freeWateringSummary,
  premiumFallback,
  predictWatering,
} = require("./plantRules");
const { generatePlantCarePremiumGemini, generateAdvancedDiagnosisGemini } = require("./plantCareGemini");
const {
  generatePlantCarePremiumOllama,
  generateAdvancedDiagnosisOllama,
} = require("./plantCareOllama");

function toNullableNumber(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * El tier lo decide solo el servidor según JWT+BD (`opts.isPremium`). El campo `premium` del body se ignora.
 * @param {object} body
 * @param {{ isPremium: boolean, language?: string }} opts
 */
async function runPlantCare(body, opts) {
  const species = String(body.species || "").trim();
  const language = String(opts.language || body.language || "es")
    .trim()
    .slice(0, 12) || "es";

  const soil_moisture = toNullableNumber(body.soil_moisture);
  const humidity = toNullableNumber(body.humidity);
  const temperature = toNullableNumber(body.temperature);
  const light = body.light != null ? String(body.light).trim().slice(0, 32) : null;
  const location = body.location != null ? String(body.location).trim().slice(0, 32) : null;

  const env = evaluateEnvironment({
    species,
    soil_moisture,
    humidity,
    temperature,
    light,
    location,
  });

  const rulesSummary = [
    env.alertMessage,
    `Códigos: ${env.codes.join(", ") || "ninguno"}`,
    light ? `Luz: ${light}` : null,
    location ? `Ubicación: ${location}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (!opts.isPremium) {
    return {
      tier: "free",
      watering: freeWateringSummary(species, env),
      alert: env.alertMessage,
    };
  }

  const ctx = {
    species,
    language,
    soil_moisture,
    humidity,
    temperature,
    light,
    location,
    rulesSummary,
  };

  try {
    const provider = resolveProvider();
    let data;
    if (provider === "ollama") {
      data = await generatePlantCarePremiumOllama(ctx);
    } else {
      data = await generatePlantCarePremiumGemini(ctx);
    }
    return {
      tier: "premium",
      ...data,
    };
  } catch (e) {
    console.warn("plant-care IA fallback:", e.message);
    const fb = premiumFallback(species, env);
    return {
      tier: "premium",
      ...fb,
    };
  }
}

async function runAdvancedDiagnosis(body) {
  const species = String(body.species || "").trim();
  const symptoms = String(body.symptoms || "").trim();
  if (!species || !symptoms) {
    const err = new Error("species y symptoms son obligatorios.");
    err.statusCode = 400;
    throw err;
  }
  const notes =
    body.notes != null && body.notes !== "" ? String(body.notes).trim().slice(0, 2000) : null;
  const language = String(body.language || "es").trim().slice(0, 12) || "es";

  const ctx = { species, symptoms, notes, language };
  const provider = resolveProvider();
  if (provider === "ollama") {
    return generateAdvancedDiagnosisOllama(ctx);
  }
  return generateAdvancedDiagnosisGemini(ctx);
}

module.exports = {
  runPlantCare,
  runAdvancedDiagnosis,
  predictWatering,
};
