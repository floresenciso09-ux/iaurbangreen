const express = require("express");
const pool = require("../db");
const { generateFullReading } = require("../src/services/simulationService");

const router = express.Router();

function toNullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** `device_id` debe ser el id numérico de `devices` (evita que `simulate` u otro texto coincida con `/:device_id`). */
function parseDeviceIdParam(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    return null;
  }
  return n;
}

/** PostgreSQL: inserción con device_id inexistente en devices. */
function respondSensorDataInsertError(res, error, logLabel) {
  if (error && error.code === "23503") {
    return res.status(400).json({
      error:
        "El device_id no está registrado. Crea el dispositivo con POST /devices y usa el id numérico devuelto en el ESP32.",
      code: "DEVICE_NOT_REGISTERED",
    });
  }
  console.error(`${logLabel}:`, error);
  return res.status(500).json({ error: "Internal server error" });
}

router.post("/", async (req, res) => {
  try {
    const { device_id, temperature, humidity, soil_moisture } = req.body;

    const deviceIdNum = parseDeviceIdParam(device_id);
    const hum = toNullableNumber(humidity);
    if (deviceIdNum == null || hum === null) {
      return res.status(400).json({
        error:
          "device_id (entero positivo, id de POST /devices) y humidity son obligatorios; temperature y soil_moisture son opcionales",
      });
    }

    const temp = toNullableNumber(temperature);
    const soil = toNullableNumber(soil_moisture);

    const result = await pool.query(
      `
      INSERT INTO sensor_data (device_id, temperature, humidity, soil_moisture)
      VALUES ($1, $2, $3, $4)
      RETURNING id, device_id, temperature, humidity, soil_moisture, created_at
      `,
      [deviceIdNum, temp, hum, soil]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return respondSensorDataInsertError(res, error, "POST /sensor-data error");
  }
});

/** Inyecta una lectura aleatoria (pruebas sin ESP32). Body: { "device_id": <id> } */
router.post("/simulate", async (req, res) => {
  try {
    const { device_id } = req.body;
    const deviceIdNum = parseDeviceIdParam(device_id);
    if (deviceIdNum == null) {
      return res.status(400).json({
        error: "device_id must be a positive integer (id returned by POST /devices)",
      });
    }
    const reading = generateFullReading();
    const result = await pool.query(
      `
      INSERT INTO sensor_data (device_id, temperature, humidity, soil_moisture)
      VALUES ($1, $2, $3, $4)
      RETURNING id, device_id, temperature, humidity, soil_moisture, created_at
      `,
      [deviceIdNum, reading.temperature, reading.humidity, reading.soil_moisture]
    );
    return res.status(201).json({
      simulated: true,
      ...result.rows[0],
    });
  } catch (error) {
    return respondSensorDataInsertError(res, error, "POST /sensor-data/simulate error");
  }
});

router.get("/", async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 100;

    const result = await pool.query(
      `
      SELECT id, device_id, temperature, humidity, soil_moisture, created_at
      FROM sensor_data
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("GET /sensor-data error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:device_id", async (req, res) => {
  try {
    const deviceIdNum = parseDeviceIdParam(req.params.device_id);
    if (deviceIdNum == null) {
      return res.status(400).json({
        error: "device_id must be a positive integer",
        code: "INVALID_DEVICE_ID",
      });
    }

    const result = await pool.query(
      `
      SELECT id, device_id, temperature, humidity, soil_moisture, created_at
      FROM sensor_data
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [deviceIdNum]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("GET /sensor-data/:device_id error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
