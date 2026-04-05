const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { registerExpoPushToken } = require("../services/notificationService");

const router = express.Router();

/**
 * POST /notifications/register-device
 * Body: { "token": "ExponentPushToken[...]" }
 */
router.post("/register-device", requireAuth, async (req, res) => {
  try {
    const token = req.body?.token;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "token es requerido (Expo push token)." });
    }
    await registerExpoPushToken(req.userId, token);
    return res.status(200).json({ ok: true });
  } catch (error) {
    const code = error.statusCode || 500;
    if (code === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error("POST /notifications/register-device error:", error);
    return res.status(500).json({ error: "No se pudo registrar el dispositivo." });
  }
});

module.exports = router;
