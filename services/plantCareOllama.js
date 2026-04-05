const {
  buildPlantCareFullPrompt,
  parsePremiumCareJson,
  buildAdvancedDiagnosisParts,
  normalizeDiagnosis,
} = require("./plantCareCommon");
const { parseInsightsJson } = require("./plantInsightsCommon");

const DEFAULT_TIMEOUT_MS = 120000;

function getOllamaBaseUrl() {
  return String(process.env.OLLAMA_BASE_URL || "").trim().replace(/\/$/, "");
}

function getOllamaModel() {
  const m = String(process.env.OLLAMA_MODEL || "llama3.2:3b").trim();
  return m || "llama3.2:3b";
}

async function ollamaGenerateJson(prompt) {
  const base = getOllamaBaseUrl();
  if (!base) {
    const err = new Error("OLLAMA_BASE_URL no configurada.");
    err.statusCode = 503;
    throw err;
  }
  const model = getOllamaModel();
  const url = `${base}/api/generate`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const headers = { "Content-Type": "application/json" };
  const extraAuth = String(process.env.OLLAMA_API_KEY || "").trim();
  if (extraAuth) headers.Authorization = `Bearer ${extraAuth}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.3, num_predict: 1200 },
      }),
      signal: controller.signal,
    });
    const rawText = await res.text();
    const data = JSON.parse(rawText);
    if (!res.ok) {
      const msg = data?.error || data?.message || `Ollama HTTP ${res.status}`;
      const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      err.statusCode = res.status === 429 ? 429 : 502;
      throw err;
    }
    const text = typeof data?.response === "string" ? data.response : "";
    if (!text.trim()) {
      const err = new Error("Respuesta vacía de Ollama.");
      err.statusCode = 502;
      throw err;
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function generatePlantCarePremiumOllama(ctx) {
  const prompt = buildPlantCareFullPrompt(ctx);
  const text = await ollamaGenerateJson(prompt);
  return parsePremiumCareJson(text);
}

async function generateAdvancedDiagnosisOllama(ctx) {
  const { instruction, userPayload } = buildAdvancedDiagnosisParts(ctx);
  const prompt = `${instruction}Datos:\n${userPayload}`;
  const text = await ollamaGenerateJson(prompt);
  const parsed = parseInsightsJson(text);
  return normalizeDiagnosis(parsed);
}

module.exports = {
  generatePlantCarePremiumOllama,
  generateAdvancedDiagnosisOllama,
};
