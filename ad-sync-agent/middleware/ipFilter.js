/**
 * middleware/ipFilter.js
 *
 * Software-level IP Whitelist middleware.
 * Only the Hostinger VPS Dedicated IP (configured in ALLOWED_IP) is allowed.
 * All other source IPs receive a 403 Forbidden response.
 */

'use strict';

const ALLOWED_IP = process.env.ALLOWED_IP;

/**
 * Normalize the request IP — handles IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
 * that Express may receive when running on a dual-stack machine.
 */
function normalizeIp(raw) {
  if (!raw) return '';
  // Strip IPv4-mapped IPv6 prefix
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
}

module.exports = function ipFilter(req, res, next) {
  // If ALLOWED_IP is '*', skip filtering (useful for local testing ONLY)
  if (!ALLOWED_IP || ALLOWED_IP === '*') {
    return next();
  }

  // Prefer X-Forwarded-For header if behind a reverse proxy; fallback to req.ip
  const forwardedFor = req.headers['x-forwarded-for'];
  const rawIp = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : req.ip || req.connection.remoteAddress;

  const clientIp = normalizeIp(rawIp);

  if (clientIp !== ALLOWED_IP) {
    console.warn(`[IP-FILTER] Blocked request from ${clientIp} — not in whitelist`);
    return res.status(403).json({
      success: false,
      message: 'Access denied: your IP is not whitelisted.',
    });
  }

  next();
};
