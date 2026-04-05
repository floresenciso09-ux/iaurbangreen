const {
  buildPlantCarePremiumParts,
  parsePremiumCareJson,
  buildAdvancedDiagnosisParts,
  normalizeDiagnosis,
} = require("./plantCareCommon");
const { parseInsightsJson } = require("./plantInsightsCommon");

const DEFAULT_TIMEOUT_MS = 50000;

function getApiKey() {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

function getModel() {
  const m = String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  return m || "gemini-2.5-flash";
}

function buildGeminiUrl(model, apiKey) {
  const base = "https://generativelanguage.googleapis.com/v1beta";
  return `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function buildBody(instruction, userPayload, useJsonMime) {
  const maxOut = (() => {
    const n = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS);
    if (Number.isFinite(n) && n >= 256 && n <= 8192) return Math.floor(n);
    return 2048;
  })();
  const gen = { temperature: 0.3, maxOutputTokens: maxOut };
  if (useJsonMime) gen.responseMimeType = "application/json";
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: `${instruction}Datos:\n${userPayload}` }],
      },
    ],
    generationConfig: gen,
  };
}

async function callGeminiGenerate(instruction, userPayload) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY no configurada.");
    err.statusCode = 503;
    err.code = "GEMINI_UNAVAILABLE";
    throw err;
  }

  const model = getModel();
  const url = buildGeminiUrl(model, apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(instruction, userPayload, true)),
      signal: controller.signal,
    });
    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      const err = new Error("Respuesta inválida de Gemini.");
      err.statusCode = 502;
      throw err;
    }
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
      const err = new Error(msg);
      err.statusCode = res.status === 429 ? 429 : 502;
      throw err;
    }
    const candidate = data?.candidates?.[0];
    const content = candidate?.content?.parts
      ?.map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();
    if (!content) {
      const err = new Error("Sin texto en la respuesta.");
      err.statusCode = 502;
      throw err;
    }
    return content;
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error("Tiempo de espera agotado al generar respuesta.");
      err.statusCode = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {Parameters<import('./plantCareCommon').buildPlantCarePremiumParts>[0]} ctx
 */
async function generatePlantCarePremiumGemini(ctx) {
  const { instruction, userPayload } = buildPlantCarePremiumParts(ctx);
  const text = await callGeminiGenerate(instruction, userPayload);
  return parsePremiumCareJson(text);
}

/**
 * @param {{ species: string, symptoms: string, notes?: string|null, language?: string }} ctx
 */
async function generateAdvancedDiagnosisGemini(ctx) {
  const { instruction, userPayload } = buildAdvancedDiagnosisParts(ctx);
  const text = await callGeminiGenerate(instruction, userPayload);
  const parsed = parseInsightsJson(text);
  return normalizeDiagnosis(parsed);
}

module.exports = {
  generatePlantCarePremiumGemini,
  generateAdvancedDiagnosisGemini,
};
