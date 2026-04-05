function toNum(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseLanguage(body) {
  const raw = body?.language;
  if (raw === undefined || raw === null) return "es";
  if (typeof raw !== "string") return { error: "language debe ser texto" };
  const v = raw.trim().slice(0, 12);
  if (!v) return "es";
  if (!/^[a-zA-Z]{2}([-_][a-zA-Z]{2})?$/.test(v)) {
    return { error: "Código de idioma no válido" };
  }
  return v.replace("_", "-").toLowerCase();
}

/**
 * @param {object} body
 */
function validatePlantCarePayload(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body JSON requerido." };
  }

  const speciesRaw = body.species;
  if (speciesRaw === undefined || speciesRaw === null || String(speciesRaw).trim() === "") {
    return { ok: false, status: 400, error: "Falta species." };
  }
  const species = String(speciesRaw).trim().slice(0, 200);

  const lang = parseLanguage(body);
  if (typeof lang === "object" && lang.error) {
    return { ok: false, status: 400, error: lang.error };
  }

  const humidity = toNum(body.humidity);
  const temperature = toNum(body.temperature);
  const soil_moisture = toNum(body.soil_moisture);

  const light =
    body.light != null && body.light !== ""
      ? String(body.light).trim().slice(0, 32)
      : null;
  const location =
    body.location != null && body.location !== ""
      ? String(body.location).trim().slice(0, 32)
      : null;

  return {
    ok: true,
    species,
    humidity,
    temperature,
    soil_moisture,
    light,
    location,
    language: lang,
    premium: body.premium === true,
  };
}

/**
 * @param {object} body
 */
function validatePredictWateringPayload(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body JSON requerido." };
  }
  const species = String(body.species || "").trim().slice(0, 200);
  if (!species) {
    return { ok: false, status: 400, error: "Falta species." };
  }
  const history = body.history;
  if (!Array.isArray(history)) {
    return { ok: false, status: 400, error: "history debe ser un array." };
  }
  if (history.length > 50) {
    return { ok: false, status: 400, error: "Máximo 50 puntos en history." };
  }
  return { ok: true, species, history };
}

/**
 * @param {object} body
 */
function validateAdvancedDiagnosisPayload(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body JSON requerido." };
  }
  const species = String(body.species || "").trim().slice(0, 200);
  const symptoms = String(body.symptoms || "").trim().slice(0, 4000);
  if (!species) return { ok: false, status: 400, error: "Falta species." };
  if (!symptoms) return { ok: false, status: 400, error: "Falta symptoms." };
  const notes =
    body.notes != null && body.notes !== ""
      ? String(body.notes).trim().slice(0, 2000)
      : null;
  const lang = parseLanguage(body);
  if (typeof lang === "object" && lang.error) {
    return { ok: false, status: 400, error: lang.error };
  }
  return { ok: true, species, symptoms, notes, language: lang };
}

module.exports = {
  validatePlantCarePayload,
  validatePredictWateringPayload,
  validateAdvancedDiagnosisPayload,
};
