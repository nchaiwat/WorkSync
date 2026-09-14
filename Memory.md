# Memory

- **DO NOT run browser automated testing (browser subagent) yourself.**
  - Wastes tokens (can exceed 50% of quota quickly) and is time-consuming.
  - Instead, write clear instructions for the user on how to verify/test the application manually.

- **Next.js Port Mapping Constraints (Local vs. VPS)**:
  - **Local**: Next.js must always map port `80:3000` via `docker-compose.override.yml` so it runs on `http://localhost` directly. Never change this or map port 3000/3001 to the host. Any port 80 conflicts on the local host are managed by the user.
  - **VPS**: The main `docker-compose.yml` must NOT contain a `ports` section for `nextjs-app` to prevent binding conflicts with Traefik (since Traefik binds to port 80 and routes traffic internally using labels).
  - **Strategy**: Keep the main `docker-compose.yml` free of `ports` for Next.js, and use `docker-compose.override.yml` (which is in `.gitignore`) to define the local port 80 mapping.

- **Database Updates**:
  - Always use `prisma db push` to update database schema (never run `prisma migrate` or `prisma migrate reset` as there are no migration files and it destroys existing data).

