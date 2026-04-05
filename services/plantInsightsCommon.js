/**
 * Texto de sistema y payload compartidos entre Gemini y Ollama.
 * @param {{ label: string, scientific_name: string | null, language: string, humidity?: number|null, temperature?: number|null, soil_moisture?: number|null }} input
 */
function buildPromptParts(input) {
  const label = String(input.label || "").trim();
  const scientific = input.scientific_name
    ? String(input.scientific_name).trim()
    : "";
  const language = String(input.language || "es").trim().slice(0, 12) || "es";

  const instruction =
    "Eres un asistente de jardinería y botánica aplicada. " +
    "Responde SOLO con un objeto JSON válido con las claves exactas: " +
    '"climate", "watering", "specialCare", "disclaimer". ' +
    "Todos los textos deben estar en el idioma indicado por el usuario. " +
    "climate: 2-4 frases sobre climas/zonas donde suele cultivarse y rangos de temperatura generales. " +
    "watering: 2-4 frases sobre frecuencia de riego y señales de sed o exceso (orientativo); si hay datos de sensores, tenlos en cuenta. " +
    "specialCare: 3-6 líneas o viñetas sobre luz, suelo, poda, plagas comunes o precauciones. " +
    "disclaimer: una frase corta de que la información es general y debe adaptarse al clima local.\n\n";

  const payload = {
    language,
    common_name: label,
    scientific_name: scientific || null,
    task: "Devuelve solo el JSON con los cuatro campos para esta especie.",
  };

  const hasSensors =
    input.humidity != null ||
    input.temperature != null ||
    input.soil_moisture != null;
  if (hasSensors) {
    payload.user_conditions = {
      humidity_percent: input.humidity ?? null,
      temperature_c: input.temperature ?? null,
      soil_moisture_percent: input.soil_moisture ?? null,
    };
    payload.task +=
      " Integra las condiciones actuales del usuario (humedad ambiental, temperatura, humedad del sustrato) en tus recomendaciones.";
  }

  const userPayload = JSON.stringify(payload);

  return { instruction, userPayload, label, language };
}

/** Prompt único para modelos que no usan chat (Ollama). */
function buildFullPrompt(input) {
  const { instruction, userPayload } = buildPromptParts(input);
  return `${instruction}Datos:\n${userPayload}`;
}

function parseJsonFromGeminiText(text) {
  const raw = String(text).trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m;
  const m = raw.match(fence);
  const inner = m ? m[1].trim() : raw;
  return JSON.parse(inner);
}

function parseInsightsJson(text) {
  const raw = String(text).trim();
  const tryParse = (s) => JSON.parse(s);
  try {
    return tryParse(raw);
  } catch {
    /* siguiente */
  }
  try {
    return parseJsonFromGeminiText(raw);
  } catch {
    /* siguiente */
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return tryParse(raw.slice(start, end + 1));
  }
  throw new Error("JSON inválido");
}

function normalizeInsights(obj) {
  const climate = safeText(obj?.climate);
  const watering = safeText(obj?.watering);
  let specialCare = safeText(obj?.specialCare);
  if (Array.isArray(obj?.specialCare)) {
    specialCare = obj.specialCare.map((x) => safeText(x)).filter(Boolean).join("\n");
  }
  const disclaimer = safeText(obj?.disclaimer);
  return {
    climate: climate || "Sin datos.",
    watering: watering || "Sin datos.",
    specialCare: specialCare || "Sin datos.",
    disclaimer:
      disclaimer ||
      "Información orientativa; adapta riego y cuidados a tu clima y sustrato.",
  };
}

function safeText(v) {
  if (v == null) return "";
  return String(v).trim();
}

module.exports = {
  buildPromptParts,
  buildFullPrompt,
  parseInsightsJson,
  normalizeInsights,
};
