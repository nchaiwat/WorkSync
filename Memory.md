# WorkSync — AI Memory & System Constraints

## 🛑 1. Operational & Resource Constraints (Standard Post-Edit Workflow — ข้อตกลงปฏิบัติการ)
- **Mandatory Post-Modification Workflow (ขั้นตอนบังคับอัตโนมัติทุกครั้งหลังแก้ไขโค้ดเสร็จสิ้น)**:
  1. **Local Build & Verification (สร้างและทดสอบฝั่ง Local)**:
     - AI ต้องทำการ build และทดสอบโค้ดทั้งหมดฝั่ง Local (เช่น `npm --prefix api run build`, `npm --prefix web run build` หรือ `docker compose up --build -d`) ให้แน่ใจว่าไม่มี Error หรือข้อผิดพลาดใดๆ
     - หากมี Schema หรือ Config เปลี่ยนแปลง ให้รัน `cd api && npx prisma db push --accept-data-loss && cd ..`
  2. **Auto-Fix on Error (แก้จนผ่านอัตโนมัติ)**:
     - หากพบข้อผิดพลาดระหว่าง build หรือรัน AI ต้องวิเคราะห์และแก้ไขโค้ดทันทีจนกระทั่งผ่านสมบูรณ์ 100%
  3. **Automated Git Push (นำส่งโค้ดทันที)**:
     - เมื่อตรวจสอบแล้วว่าทุกอย่าง Build ผ่านฉลุย ไม่พบ Error ให้ AI ทำการ `git add .`, `git commit -m "..."` และ `git push origin main` ขึ้น Git Server ทันทีโดยไม่ต้องรอให้สั่ง
  4. **VPS Command Reporting with `cd /var/www/Worksync` (คำสั่งสำหรับ VPS)**:
     - ชุดคำสั่ง VPS ที่แจ้งให้ผู้ใช้ทราบ **ต้องมีคำสั่ง `cd /var/www/Worksync` นำหน้าทุกครั้งเสมอ** ก่อนรันคำสั่ง Docker หรือคำสั่งอื่นๆ
     - สรุปผลการแก้ไขอย่างกระชับ พร้อมแนบคำสั่งให้ผู้ใช้คัดลอกไปวางบน VPS ได้ทันที
- **DO NOT run browser automated testing (`browser_subagent`) yourself**:
  - Consumes large amounts of quota rapidly.
  - Instead, write clear, step-by-step instructions for the user on how to verify/test changes manually.

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
- **Dual Flow Support**:
  - **SP-Initiated SSO**: ผู้ใช้กดล็อกอินจากหน้าเว็บ WorkSync จะสร้าง `code_verifier` (PKCE) เก็บใน `sessionStorage`
  - **IdP-Initiated SSO (Portal Launch)**: ผู้ใช้กดเปิดแอปจากหน้า Central IAM Portal (`ciam.windowasia.com/portal`) จะไม่มี `code_verifier` ดังนั้น Backend ต้องรองรับแบบ `code_verifier` เป็น optional และใช้ `client_id` + `client_secret` ในการแลกรับ Token
- **Zero-Confusion Standard**: เมื่อ `ciam_sso_enabled` is false, `/login` immediately behaves as a 100% clean standard credentials form with no SSO elements.
- **Cache-Busting**: When fetching `/settings/ciam-sso` or `/auth/sso/config`, include `_t=${Date.now()}` query param and `cache: 'no-store'` header to ensure immediate toggle responsiveness.
- **Audit Trails**: Major security actions (logins, settings changes, break-glass toggles) are recorded into `transaction_logs` via `TransactionLogsService`.

---

## ⚡ 6. คำสั่งสำคัญที่ใช้บ่อย (Essential Commands Cheat Sheet)

### 💻 ฝั่งเครื่องคอมพิวเตอร์ของคุณ (Local Machine)

```bash
# ─── 1. Build & Test Verification (ทดสอบก่อน Deploy) ───
npm --prefix api run build                  # ทดสอบบิวด์ NestJS Backend
npm --prefix web run build                  # ทดสอบบิวด์ Next.js Frontend

# ─── 2. Database Schema & Seed (ข้อมูลไม่หาย) ───
cd api && npx prisma db push --accept-data-loss && cd ..   # ซิงค์ Schema เข้า DB Local
cd api && node prisma/seed.js && cd ..                     # ลงข้อมูลตั้งค่าเริ่มต้น

# ─── 3. Docker Compose (รันระบบบนเครื่องตัวเอง) ───
docker compose up --build -d                # รันคอนเทนเนอร์ทั้งหมดพร้อมรีบิวด์
docker compose up --build -d api            # รีบิวด์เฉพาะ API
docker compose up --build -d nextjs-app     # รีบิวด์เฉพาะ Frontend
docker compose restart nextjs-app           # ล้าง DNS Cache ใน Next.js
docker compose down                         # หยุดและปิดคอนเทนเนอร์ทั้งหมด

# ─── 4. Git Operations ───
git status
git add .
git commit -m "คำอธิบายการแก้ไข"
git push origin main
```

---

### ☁️ ฝั่งเซิร์ฟเวอร์หลัก (VPS — ต้องมี `cd /var/www/Worksync` เสมอ)

```bash
# ─── 1. Standard Update & Deploy (แก้ทั่วไป) ───
cd /var/www/Worksync
git pull origin main
docker compose up --build -d api
docker compose restart nextjs-app

# ─── 2. Deploy เมื่อแก้ Frontend ───
cd /var/www/Worksync
git pull origin main
docker compose up --build -d nextjs-app

# ─── 3. Deploy เมื่อมีการแก้ Database Schema หรือ Settings ใหม่ ───
cd /var/www/Worksync
git pull origin main
docker compose exec api npx prisma db push --accept-data-loss
docker compose exec api node prisma/seed.js
docker compose up --build -d api
docker compose restart nextjs-app

# ─── 4. Rebuild ทั้งหมดแบบไม่ใช้ Cache (กรณีโค้ดไม่อัปเดต) ───
cd /var/www/Worksync
docker compose build --no-cache api nextjs-app
docker compose up -d api nextjs-app
docker compose restart nextjs-app

# ─── 5. ตรวจสอบสถานะและ Troubleshooting บน VPS ───
cd /var/www/Worksync
docker compose ps                                         # ตรวจสอบสถานะคอนเทนเนอร์
docker logs -f worksync-api --tail 50                     # ดู Log การทำงานของ Backend
docker logs -f worksync-nextjs --tail 50                  # ดู Log การทำงานของ Frontend
docker exec worksync-api env | grep CIAM                  # ตรวจสอบ Environment ของ API
docker inspect worksync-api --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' # ดู IP ของ API
```
