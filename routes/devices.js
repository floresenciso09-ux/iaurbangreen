const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();     

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, location, latitude, longitude, created_at FROM devices ORDER BY created_at DESC"
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("GET /devices error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, location, latitude, longitude } = req.body;

    if (
      !name ||
      !location ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        error: "name, location, latitude and longitude are required",
      });
    }

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        error: "latitude and longitude must be valid numbers",
      });
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: "latitude must be between -90 and 90, longitude between -180 and 180",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO devices (name, location, latitude, longitude)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, location, latitude, longitude, created_at
      `,
      [name, location, lat, lon]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("POST /devices error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Vincula un dispositivo al usuario autenticado (`devices.user_id`) para alertas y el job plantMonitor.
 * Body: { "link_to_me": true }
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "id inválido" });
    }
    if (req.body?.link_to_me !== true) {
      return res.status(400).json({ error: 'Envía { "link_to_me": true } para vincular el dispositivo a tu cuenta.' });
    }
    const result = await pool.query(
      `UPDATE devices SET user_id = $1 WHERE id = $2 RETURNING id, name, user_id`,
      [req.userId, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Dispositivo no encontrado" });
    }
    return res.status(200).json({ device: result.rows[0] });
  } catch (error) {
    console.error("PATCH /devices/:id error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
