const cron = require("node-cron");
const pool = require("../db");
const { sendExpoPush, getTokensForUser } = require("../services/notificationService");
const { DRY_SOIL } = require("../services/plantRules");

/**
 * Revisa dispositivos vinculados a usuario (`devices.user_id`) con última lectura de suelo seca.
 */
async function runPlantMonitor() {
  const devices = await pool.query(
    `SELECT id, user_id FROM devices WHERE user_id IS NOT NULL`
  );

  for (const d of devices.rows) {
    const last = await pool.query(
      `SELECT soil_moisture FROM sensor_data WHERE device_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [d.id]
    );
    if (last.rowCount === 0) continue;
    const soil = Number(last.rows[0].soil_moisture);
    if (!Number.isFinite(soil) || soil >= DRY_SOIL) continue;

    const tokens = await getTokensForUser(d.user_id);
    if (tokens.length === 0) {
      console.log(
        `[plantMonitor] device ${d.id} low soil (${soil}) — user ${d.user_id} sin tokens push`
      );
      continue;
    }

    try {
      await sendExpoPush(tokens, {
        title: "Urban Green",
        body: "Tu planta puede necesitar agua: sustrato seco según el último sensor.",
      });
      console.log(`[plantMonitor] notified user ${d.user_id} (device ${d.id})`);
    } catch (e) {
      console.error("[plantMonitor] push failed:", e.message);
    }
  }
}

function schedulePlantMonitor() {
  if (String(process.env.PLANT_MONITOR_DISABLED || "").toLowerCase() === "true") {
    console.log("Plant monitor: desactivado (PLANT_MONITOR_DISABLED=true).");
    return;
  }
  const expr = String(process.env.PLANT_MONITOR_CRON || "0 */6 * * *").trim();
  cron.schedule(expr, () => {
    runPlantMonitor().catch((err) => console.error("plantMonitor error:", err));
  });
  console.log(`Plant monitor cron: ${expr}`);
}

module.exports = { runPlantMonitor, schedulePlantMonitor };
