# WorkSync — AI Memory & System Constraints

## 🛑 1. Operational & Resource Constraints
- **DO NOT run browser automated testing (`browser_subagent`) yourself**:
  - Consumes large amounts of quota rapidly.
  - Instead, write clear, step-by-step instructions for the user on how to verify/test changes manually.
- **Always provide concise explanations and the dual sets of Git & Docker commands (Local & VPS)** in every completion response.

---

## 🌐 2. Network & Port Constraints (Local vs. VPS)
- **Local Machine**:
  - `nextjs-app` must always be accessible on `http://localhost` (port 80).
  - Port mapping `80:3000` is maintained exclusively inside `docker-compose.override.yml` (which is gitignored).
  - Never map port 80 in the root `docker-compose.yml`.
- **VPS (Hostinger Traefik Architecture)**:
  - Traefik binds ports 80 and 443 across the entire VPS host.
  - Hostinger Docker Manager runs containers named `api` and `postgres` on the external `root_default` network.
  - **NEVER** use the hostname `api` to refer to WorkSync backend. Always use **`worksync-api`** (`http://worksync-api:4000`).
  - Next.js rewrites in `web/next.config.js` must proxy to `http://worksync-api:4000`.
  - The main `docker-compose.yml` must NOT have `ports:` on `postgres` or `nextjs-app`.

---

## 🗄️ 3. Database Safety & Migration Protocol
- **Strict Data Safety Rule**: Never delete, truncate, drop, or reset any database tables.
- **Never use `prisma migrate` or `prisma migrate reset`** (there are no migration history files).
- **Always update database schemas using `prisma db push`**:
  ```bash
  # Local:
  cd api && npx prisma db push --accept-data-loss && cd ..
  # VPS:
  docker compose exec api npx prisma db push --accept-data-loss
  ```
- After schema updates, ensure seed defaults are applied if necessary:
  ```bash
  docker compose exec api node prisma/seed.js
  ```

---

## 🔄 4. DNS Cache Invalidation Rule
- **CRITICAL**: Every time the `api` container is rebuilt or recreated on the VPS:
  ```bash
  docker compose up --build -d api
  docker compose restart nextjs-app   # <-- MANDATORY!
  ```
  - **Reason**: Recreating the API container generates a new internal IP on `worksync-network`. Next.js caches resolved DNS addresses; without restarting Next.js, it will attempt connections to the old IP and throw `ECONNREFUSED`.

---

## 🔐 5. Central IAM SSO (v2.0.0 Zero `.env` Architecture)
- **Dynamic Config**: All OIDC and SSO configuration parameters reside in the `system_settings` table (managed via `SettingsService` with an in-memory cache).
- **Zero-Confusion Standard**: When `ciam_sso_enabled` is false, `/login` immediately behaves as a 100% clean standard credentials form with no SSO elements.
- **Cache-Busting**: When fetching `/settings/ciam-sso` or `/auth/sso/config`, include `_t=${Date.now()}` query param and `cache: 'no-store'` header to ensure immediate toggle responsiveness.
- **Audit Trails**: Major security actions (logins, settings changes, break-glass toggles) are recorded into `transaction_logs` via `TransactionLogsService`.
