const pool = require("../db");

/**
 * Debe ir después de `requireAuth`. Comprueba suscripción premium activa en BD.
 */
async function requirePremium(req, res, next) {
  try {
    const r = await pool.query(
      "SELECT is_premium, premium_until FROM users WHERE id = $1 LIMIT 1",
      [req.userId]
    );
    if (r.rowCount === 0) {
      return res.status(401).json({ error: "Usuario no encontrado.", code: "USER_NOT_FOUND" });
    }
    const row = r.rows[0];
    const until = row.premium_until ? new Date(row.premium_until) : null;
    const active =
      row.is_premium === true && (!until || until.getTime() > Date.now());

    if (!active) {
      return res.status(403).json({
        error: "Premium required",
        code: "PREMIUM_REQUIRED",
      });
    }
    return next();
  } catch (err) {
    console.error("requirePremium error:", err);
    return res.status(500).json({ error: "Error al comprobar la suscripción." });
  }
}

module.exports = { requirePremium };
