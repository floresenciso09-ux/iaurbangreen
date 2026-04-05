const { parseInsightsJson } = require("./plantInsightsCommon");

function safeText(v) {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Prompt PREMIUM: JSON estructurado con riego detallado.
 * @param {{ species: string, language: string, soil_moisture?: number|null, humidity?: number|null, temperature?: number|null, light?: string|null, location?: string|null, rulesSummary: string }} ctx
 */
function buildPlantCarePremiumParts(ctx) {
  const language = String(ctx.language || "es").slice(0, 12) || "es";
  const instruction =
    "Eres un experto en botánica y cultivo. Responde SOLO con un objeto JSON válido con las claves exactas: " +
    '"watering", "health", "tips", "alerts", "confidence". ' +
    "watering debe ser un objeto con: frequency (texto), next_watering (fecha ISO solo día YYYY-MM-DD), reason (texto breve). " +
    "health: una frase sobre estado estimado. tips: array de strings (3-5). alerts: array de strings (0-3). " +
    "confidence: número entre 0 y 1. " +
    `Todo en idioma ${language}. Usa el contexto de sensores y las reglas resumidas.\n\n`;

  const userPayload = JSON.stringify({
    species: ctx.species,
    language,
    soil_moisture: ctx.soil_moisture,
    humidity: ctx.humidity,
    temperature: ctx.temperature,
    light: ctx.light,
    location: ctx.location,
    rules_summary: ctx.rulesSummary,
    task: "Devuelve solo el JSON pedido.",
  });

  return { instruction, userPayload };
}

function buildPlantCareFullPrompt(ctx) {
  const { instruction, userPayload } = buildPlantCarePremiumParts(ctx);
  return `${instruction}Datos:\n${userPayload}`;
}

function normalizePremiumCare(obj) {
  const w = obj?.watering;
  let watering;
  if (w && typeof w === "object") {
    watering = {
      frequency: safeText(w.frequency) || "según sustrato y clima",
      next_watering: safeText(w.next_watering) || new Date().toISOString().slice(0, 10),
      reason: safeText(w.reason) || "contexto ambiental",
    };
  } else {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    watering = {
      frequency: "cada pocos días",
      next_watering: d.toISOString().slice(0, 10),
      reason: safeText(w) || "ajustar según observación",
    };
  }

  let tips = Array.isArray(obj?.tips) ? obj.tips.map((t) => safeText(t)).filter(Boolean) : [];
  if (tips.length === 0) tips = ["Observa el sustrato antes de regar de nuevo."];

  let alerts = Array.isArray(obj?.alerts)
    ? obj.alerts.map((t) => safeText(t)).filter(Boolean)
    : [];

  let conf = Number(obj?.confidence);
  if (!Number.isFinite(conf)) conf = 0.75;
  conf = Math.min(1, Math.max(0, conf));

  return {
    watering,
    health: safeText(obj?.health) || "Sin datos.",
    tips,
    alerts,
    confidence: conf,
  };
}

function parsePremiumCareJson(text) {
  const parsed = parseInsightsJson(text);
  return normalizePremiumCare(parsed);
}

/**
 * Diagnóstico avanzado (premium).
 */
function buildAdvancedDiagnosisParts(ctx) {
  const language = String(ctx.language || "es").slice(0, 12) || "es";
  const instruction =
    "Eres fitopatólogo consultor. Responde SOLO JSON con claves: summary, probable_causes (array string), actions (array string), urgency (low|medium|high). " +
    `Idioma: ${language}.\n\n`;

  const userPayload = JSON.stringify({
    species: ctx.species,
    symptoms: ctx.symptoms,
    notes: ctx.notes || null,
  });

  return { instruction, userPayload };
}

function normalizeDiagnosis(obj) {
  return {
    summary: safeText(obj?.summary) || "Sin resumen.",
    probable_causes: Array.isArray(obj?.probable_causes)
      ? obj.probable_causes.map((x) => safeText(x)).filter(Boolean)
      : [],
    actions: Array.isArray(obj?.actions) ? obj.actions.map((x) => safeText(x)).filter(Boolean) : [],
    urgency: ["low", "medium", "high"].includes(obj?.urgency) ? obj.urgency : "low",
  };
}

module.exports = {
  buildPlantCarePremiumParts,
  buildPlantCareFullPrompt,
  parsePremiumCareJson,
  normalizePremiumCare,
  buildAdvancedDiagnosisParts,
  normalizeDiagnosis,
};
