/**
 * middleware/decrypt.js
 *
 * AES-256-GCM payload decryption middleware.
 *
 * WorkSync (Hostinger) encrypts the request body with the shared key before
 * sending it to this agent. This middleware decrypts it so that route handlers
 * receive the plain { username, password } object in req.decryptedBody.
 *
 * Expected request body shape:
 * {
 *   iv:        "hex-encoded 12-byte IV",
 *   encrypted: "hex-encoded ciphertext",
 *   authTag:   "hex-encoded 16-byte GCM auth tag"
 * }
 */

'use strict';

const crypto = require('crypto');

const SHARED_KEY = process.env.SHARED_KEY;

/**
 * Derive a 32-byte AES key from the SHARED_KEY string using SHA-256.
 * This lets the shared key be any length string instead of requiring
 * exactly 32 bytes of binary data.
 */
function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

module.exports = function decryptPayload(req, res, next) {
  if (!SHARED_KEY) {
    console.error('[DECRYPT] SHARED_KEY is not configured in .env');
    return res.status(500).json({ success: false, message: 'Agent misconfigured: missing SHARED_KEY.' });
  }

  const { iv, encrypted, authTag } = req.body || {};

  if (!iv || !encrypted || !authTag) {
    return res.status(400).json({
      success: false,
      message: 'Bad request: missing encrypted payload fields (iv, encrypted, authTag).',
    });
  }

  try {
    const key = deriveKey(SHARED_KEY);
    const ivBuf = Buffer.from(iv, 'hex');
    const encBuf = Buffer.from(encrypted, 'hex');
    const authTagBuf = Buffer.from(authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf);
    decipher.setAuthTag(authTagBuf);

    const decrypted = Buffer.concat([decipher.update(encBuf), decipher.final()]);
    req.decryptedBody = JSON.parse(decrypted.toString('utf8'));

    next();
  } catch (err) {
    console.warn('[DECRYPT] Decryption failed:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed: could not decrypt payload. Invalid key or tampered data.',
    });
  }
};
