const pool = require("../db");

/**
 * Registra o actualiza token Expo para el usuario (upsert por par user_id+token).
 * @param {number} userId
 * @param {string} token
 */
async function registerExpoPushToken(userId, token) {
  const t = String(token || "").trim();
  if (!t || t.length > 500) {
    const err = new Error("Token inválido.");
    err.statusCode = 400;
    throw err;
  }

  await pool.query(
    `
    INSERT INTO user_push_tokens (user_id, expo_token)
    VALUES ($1, $2)
    ON CONFLICT (user_id, expo_token) DO UPDATE SET created_at = NOW()
    `,
    [userId, t]
  );
}

/**
 * Envía notificación Expo Push (https://docs.expo.dev/push-notifications/sending-notifications/).
 * @param {string[]} expoTokens
 * @param {{ title: string, body: string }} payload
 */
async function sendExpoPush(expoTokens, payload) {
  const tokens = [...new Set(expoTokens.map((x) => String(x).trim()).filter(Boolean))];
  if (tokens.length === 0) return { sent: 0 };

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title: payload.title,
    body: payload.body,
    priority: "high",
    channelId: "default",
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.errors?.[0]?.message || `Expo push HTTP ${res.status}`);
    err.statusCode = 502;
    throw err;
  }
  return { sent: tokens.length, data };
}

/**
 * Tokens de un usuario.
 * @param {number} userId
 */
async function getTokensForUser(userId) {
  const r = await pool.query(
    `SELECT expo_token FROM user_push_tokens WHERE user_id = $1`,
    [userId]
  );
  return r.rows.map((row) => row.expo_token);
}

module.exports = {
  registerExpoPushToken,
  sendExpoPush,
  getTokensForUser,
};
