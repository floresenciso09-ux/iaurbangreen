/**
 * Reglas deterministas para alertas, copy FREE y predicción simple sin modelo ML.
 */

const DRY_SOIL = 22;
const LOW_HUMIDITY = 35;
const HIGH_TEMP = 32;

/**
 * @param {object} input
 * @param {string} input.species
 * @param {number|null} [input.soil_moisture]
 * @param {number|null} [input.humidity]
 * @param {number|null} [input.temperature]
 * @param {string|null} [input.light]
 * @param {string|null} [input.location]
 */
function evaluateEnvironment(input) {
  const soil = input.soil_moisture;
  const hum = input.humidity;
  const temp = input.temperature;

  const alerts = [];
  if (soil != null && Number.isFinite(soil) && soil < DRY_SOIL) {
    alerts.push("soil_dry");
  }
  if (hum != null && Number.isFinite(hum) && hum < LOW_HUMIDITY) {
    alerts.push("air_dry");
  }
  if (temp != null && Number.isFinite(temp) && temp > HIGH_TEMP) {
    alerts.push("heat_stress");
  }

  let alertMessage = "";
  if (alerts.includes("soil_dry")) {
    alertMessage = "La humedad del sustrato es baja; conviene regar pronto.";
  } else if (alerts.includes("air_dry")) {
    alertMessage = "La humedad ambiental es baja.";
  } else if (alerts.includes("heat_stress")) {
    alertMessage = "Temperatura alta; vigila el riego y el estrés térmico.";
  } else {
    alertMessage = "Condiciones dentro de lo razonable según los datos enviados.";
  }

  return { alerts, alertMessage, codes: alerts };
}

/**
 * Texto breve FREE (sin llamada IA).
 */
function freeWateringSummary(species, env) {
  const name = String(species || "planta").trim() || "planta";
  const hasDrySoil = env.codes.includes("soil_dry");
  const hasHeat = env.codes.includes("heat_stress");

  if (hasDrySoil && hasHeat) {
    return `Para ${name}, riega con moderación cuando el sustrato se seque en superficie; en calor intenso puede necesitarse más frecuencia.`;
  }
  if (hasDrySoil) {
    return `Para ${name}, riega cuando el sustrato esté ligeramente seco; evita encharcar.`;
  }
  return `Para ${name}, mantén el sustrato ligeramente húmedo sin encharcar; ajusta según estación.`;
}

/**
 * Fallback PREMIUM si la IA falla.
 */
function premiumFallback(species, env) {
  const next = new Date();
  next.setDate(next.getDate() + (env.codes.includes("soil_dry") ? 1 : 3));

  return {
    watering: {
      frequency: env.codes.includes("soil_dry") ? "pronto" : "cada 3–5 días",
      next_watering: next.toISOString().slice(0, 10),
      reason: env.alertMessage,
    },
    health:
      env.codes.length > 0
        ? "riesgo leve por condiciones actuales (datos de sensores)"
        : "condición aparentemente estable",
    tips: [
      "Revisa drenaje y luz según la especie.",
      "Evita sol directo fuerte si la planta es de interior.",
    ],
    alerts: env.codes.includes("soil_dry") ? ["regar en las próximas 24h"] : [],
    confidence: 0.55,
  };
}

/**
 * @param {Array<{ humidity?: number, soil?: number, soil_moisture?: number }>} history
 */
function predictWatering(history) {
  if (!Array.isArray(history) || history.length < 1) {
    return { next_watering_in_days: 7, risk: "unknown" };
  }

  const normalized = history.map((h) => {
    const soil = h.soil_moisture != null ? Number(h.soil_moisture) : Number(h.soil);
    return {
      humidity: h.humidity != null ? Number(h.humidity) : null,
      soil: Number.isFinite(soil) ? soil : null,
    };
  });

  const last = normalized[normalized.length - 1];
  const first = normalized[0];
  let trend = 0;
  if (last.soil != null && first.soil != null && normalized.length >= 2) {
    trend = (last.soil - first.soil) / (normalized.length - 1 || 1);
  }

  let days = 5;
  let risk = "low";

  if (last.soil != null && last.soil < DRY_SOIL) {
    days = 0;
    risk = "high";
  } else if (trend < -3) {
    days = 2;
    risk = "medium";
  } else if (last.soil != null && last.soil < 40) {
    days = 3;
    risk = "medium";
  } else {
    days = Math.min(14, Math.max(2, Math.round(7 + trend)));
  }

  return { next_watering_in_days: days, risk };
}

module.exports = {
  evaluateEnvironment,
  freeWateringSummary,
  premiumFallback,
  predictWatering,
  DRY_SOIL,
};
