/**
 * services/ldap.js
 *
 * LDAP / Active Directory service.
 * Authenticates a user against AD and reads their Pager field (Telegram ID).
 *
 * Library: ldapts  (pure-JS LDAP client — no native bindings required)
 */

'use strict';

const { Client } = require('ldapts');

const AD_URL      = process.env.AD_URL;
const AD_BASE_DN  = process.env.AD_BASE_DN;
const AD_BIND_DN  = process.env.AD_BIND_DN;
const AD_BIND_PASSWORD = process.env.AD_BIND_PASSWORD;

/**
 * Authenticate a user against Active Directory using their sAMAccountName
 * (Windows login name, e.g. "john.doe") and password.
 *
 * Flow:
 *  1. Bind with the service account to search the directory
 *  2. Find the user's full DN by searching for sAMAccountName
 *  3. Bind again with the user's own DN + password to verify credentials
 *  4. Read the `pager` attribute (stores Telegram ID per company convention)
 *  5. Return { success, telegram_id }
 *
 * @param {string} username  - sAMAccountName of the user
 * @param {string} password  - Plain-text password (never stored)
 * @returns {Promise<{ success: boolean, telegram_id?: string }>}
 */
async function authenticateUser(username, password) {
  if (!AD_URL || !AD_BASE_DN || !AD_BIND_DN || !AD_BIND_PASSWORD) {
    throw new Error('AD configuration is incomplete. Check .env variables.');
  }

  // Sanitize username to prevent LDAP injection
  const safeName = username.replace(/[^a-zA-Z0-9._\-@]/g, '');
  if (!safeName) throw new Error('Invalid username format.');

  const client = new Client({
    url: AD_URL,
    timeout: 8000,
    connectTimeout: 5000,
    tlsOptions: { rejectUnauthorized: false }, // Set to true if using a trusted cert
  });

  try {
    // Step 1: Bind with service account to search directory
    await client.bind(AD_BIND_DN, AD_BIND_PASSWORD);

    // Step 2: Search for the user entry by sAMAccountName
    const { searchEntries } = await client.search(AD_BASE_DN, {
      scope: 'sub',
      filter: `(sAMAccountName=${safeName})`,
      attributes: ['dn', 'pager', 'displayName', 'mail'],
    });

    if (!searchEntries || searchEntries.length === 0) {
      console.warn(`[LDAP] User not found: ${safeName}`);
      return { success: false };
    }

    const userEntry = searchEntries[0];
    const userDn = userEntry.dn;

    // Step 3: Bind as the actual user to verify their password
    await client.bind(userDn, password);

    // Step 4: Read Pager field (Telegram ID)
    const telegramId = userEntry.pager
      ? (Array.isArray(userEntry.pager) ? userEntry.pager[0] : userEntry.pager).toString()
      : null;

    console.log(`[LDAP] Authenticated: ${safeName} (Telegram: ${telegramId || 'none'})`);

    return {
      success: true,
      telegram_id: telegramId || undefined,
    };
  } catch (err) {
    // LDAP invalid credentials error code: 49
    if (err.code === 49 || (err.message && err.message.toLowerCase().includes('invalid credentials'))) {
      console.warn(`[LDAP] Invalid credentials for: ${safeName}`);
      return { success: false };
    }
    // Re-throw unexpected errors
    console.error(`[LDAP] Unexpected error for ${safeName}:`, err.message);
    throw err;
  } finally {
    // Always unbind / release the connection
    await client.unbind().catch(() => {});
  }
}

module.exports = { authenticateUser };
