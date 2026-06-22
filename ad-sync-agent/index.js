/**
 * index.js — AD Sync Agent Main Entry Point
 *
 * On-Premise HTTP service that:
 *  1. Listens for encrypted authentication requests from WorkSync (Hostinger VPS)
 *  2. Verifies source IP against whitelist (ALLOWED_IP)
 *  3. Decrypts AES-256-GCM payload using Pre-shared Key (SHARED_KEY)
 *  4. Authenticates user credentials against Active Directory via LDAP
 *  5. Returns authentication result + Telegram ID (from AD Pager field)
 *
 * Security layers:
 *  ✅ HTTPS (handled by your reverse proxy / SSL cert on this machine)
 *  ✅ IP Whitelist (only Hostinger Dedicated IP allowed)
 *  ✅ AES-256-GCM payload encryption (prevents MITM even on plain HTTP)
 *  ✅ LDAP sanitization (prevents injection attacks)
 *  ✅ Read-only service account for AD queries
 */

'use strict';

require('dotenv').config();

const express = require('express');
const ipFilter = require('./middleware/ipFilter');
const decryptPayload = require('./middleware/decrypt');
const { authenticateUser } = require('./services/ldap');

const app = express();
const PORT = process.env.PORT || 3100;

// ── Global Middleware ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));  // Limit body size to prevent DoS

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AD Sync Agent',
    timestamp: new Date().toISOString(),
    ad_url: process.env.AD_URL || 'not configured',
  });
});

// ── Auth Verify Endpoint ───────────────────────────────────────────────────
// POST /auth/verify
// Protected by: IP Whitelist → AES-256-GCM Decryption → LDAP Auth
app.post(
  '/auth/verify',
  ipFilter,         // Layer 1: Check source IP against ALLOWED_IP
  decryptPayload,   // Layer 2: Decrypt AES-256-GCM payload → req.decryptedBody
  async (req, res) => {
    const { username, password } = req.decryptedBody || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Bad request: username and password are required.',
      });
    }

    try {
      const result = await authenticateUser(username, password);

      if (!result.success) {
        // Return 401 but do NOT reveal whether user exists or not (security best practice)
        return res.status(401).json({
          success: false,
          message: 'Authentication failed: invalid credentials.',
        });
      }

      return res.json({
        success: true,
        telegram_id: result.telegram_id || null,
      });
    } catch (err) {
      console.error('[ROUTE /auth/verify] Internal error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Internal server error. Please check agent logs.',
      });
    }
  }
);

// ── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found.' });
});

// ── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║         WorkSync AD Sync Agent           ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Port    : ${PORT.toString().padEnd(30)}║`);
  console.log(`║  AD URL  : ${(process.env.AD_URL || 'NOT SET').padEnd(30)}║`);
  console.log(`║  IP Lock : ${(process.env.ALLOWED_IP || '*').padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════╝');
});

module.exports = app;
