const jwt = require("jsonwebtoken");
const pool = require("../db");
const { getJwtSecret } = require("../utils/jwtSecret");

/**
 * Si hay `Authorization: Bearer` válido, rellena req.authUserId y req.authIsPremium.
 * Si no hay token o es inválido, continúa sin error (usuario anónimo).
 */
async function optionalAuth(req, res, next) {
  req.authUserId = null;
  req.authIsPremium = false;

  const raw = req.headers.authorization;
  if (!raw || typeof raw !== "string") {
    return next();
  }
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  if (!match) {
    return next();
  }

  try {
    const decoded = jwt.verify(match[1], getJwtSecret(), { algorithms: ["HS256"] });
    const userId = Number(decoded.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      return next();
    }

    const r = await pool.query(
      "SELECT is_premium, premium_until FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    if (r.rowCount === 0) {
      return next();
    }

    const row = r.rows[0];
    const until = row.premium_until ? new Date(row.premium_until) : null;
    const active =
      row.is_premium === true && (!until || until.getTime() > Date.now());

    req.authUserId = userId;
    req.authIsPremium = Boolean(active);
    return next();
  } catch {
    return next();
  }
}

module.exports = { optionalAuth };
