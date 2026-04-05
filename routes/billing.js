const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

/**
 * POST /billing/subscribe
 * Sin STRIPE_SECRET_KEY: activa premium de desarrollo (30 días). Con Stripe: 501 hasta integrar webhooks.
 */
router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    const plan = typeof req.body?.plan === "string" ? req.body.plan.trim().slice(0, 64) : "";
    const payment_method =
      typeof req.body?.payment_method === "string"
        ? req.body.payment_method.trim().slice(0, 32)
        : "";

    if (!plan) {
      return res.status(400).json({ error: "plan es requerido (ej. premium_monthly)." });
    }

    const stripeKey = String(process.env.STRIPE_SECRET_KEY || "").trim();

    await pool.query(
      `INSERT INTO billing_events (user_id, plan, provider) VALUES ($1, $2, $3)`,
      [req.userId, plan, payment_method || (stripeKey ? "stripe" : "development")]
    );

    if (!stripeKey) {
      await pool.query(
        `UPDATE users
         SET is_premium = TRUE,
             premium_until = NOW() + INTERVAL '30 days'
         WHERE id = $1`,
        [req.userId]
      );
      const u = await pool.query(
        `SELECT premium_until FROM users WHERE id = $1`,
        [req.userId]
      );
      const premium_until =
        u.rows[0]?.premium_until instanceof Date
          ? u.rows[0].premium_until.toISOString()
          : u.rows[0]?.premium_until;

      return res.status(200).json({
        ok: true,
        mode: "development",
        message:
          "Premium activado para pruebas (30 días). Configura STRIPE_SECRET_KEY para cobros reales.",
        plan,
        premium_until,
      });
    }

    return res.status(501).json({
      error: "Stripe Checkout aún no está integrado. Usa modo desarrollo sin STRIPE_SECRET_KEY o implementa el webhook.",
      code: "STRIPE_PENDING",
    });
  } catch (error) {
    console.error("POST /billing/subscribe error:", error);
    return res.status(500).json({ error: "No se pudo registrar la suscripción." });
  }
});

module.exports = router;
