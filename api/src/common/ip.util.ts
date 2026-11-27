export const CIAM_FRAMEWORK_VERSION = '2.15.0';
export const SYSTEM_IP_FALLBACK = '127.0.0.1 (SYSTEM)';

/**
 * Normalize raw IP / header value:
 * - Takes first comma-separated segment
 * - Strips IPv4-mapped IPv6 prefix (::ffff:)
 * - Falls back to '127.0.0.1 (SYSTEM)' if empty or 'unknown'
 * - Truncates to 50 chars max (VARCHAR(50))
 */
export function normalizeIp(raw?: string | string[] | null): string {
  if (!raw) return SYSTEM_IP_FALLBACK;
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (!str || typeof str !== 'string') return SYSTEM_IP_FALLBACK;

  const firstSegment = str.split(',')[0].trim().replace(/^::ffff:/i, '');
  if (!firstSegment || firstSegment.toLowerCase() === 'unknown') {
    return SYSTEM_IP_FALLBACK;
  }
  return firstSegment.slice(0, 50);
}

/**
 * Extract real client IP from standard HTTP/Reverse Proxy headers:
 * x-forwarded-for (first hop) -> x-real-ip -> socket.remoteAddress -> req.ip -> SYSTEM_IP_FALLBACK
 */
export function extractClientIp(req?: any): string {
  if (!req) return SYSTEM_IP_FALLBACK;
  const headers = req.headers || {};
  const raw =
    headers['x-forwarded-for'] ||
    headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip;
  return normalizeIp(raw);
}

/**
 * Extract Central IAM M2M Origin IP (Section C / 10.2):
 * x-ciam-origin-ip -> x-origin-ip -> x-forwarded-for -> x-real-ip -> socket.remoteAddress -> req.ip
 */
export function extractCiamOriginIp(req?: any): string {
  if (!req) return SYSTEM_IP_FALLBACK;
  const headers = req.headers || {};
  const raw =
    headers['x-ciam-origin-ip'] ||
    headers['x-origin-ip'] ||
    headers['x-forwarded-for'] ||
    headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip;
  return normalizeIp(raw);
}
