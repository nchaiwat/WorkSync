# WorkSync — Handover & Continuation Guide (HANDOFF.md)
**อัปเดตล่าสุด:** 27 พฤศจิกายน 2026  
**สถานะโปรเจกต์:** Production Ready / Central IAM Enterprise Integration Specification v2.15.0 Full Compliance  
**Git Branch:** `main` (Synced with `origin/main` — Base Commit `d717f80`)

---

## 📌 1. ภาพรวมโปรเจกต์ (Project Overview)

**WorkSync** คือระบบบริหารจัดการภารกิจและติดตามงาน (Task Tracking & Enterprise Collaboration Platform) แบบ Real-time ที่พัฒนาขึ้นเพื่อตอบโจทย์การทำงานในองค์กร Window Asia รองรับการใช้งานเต็มรูปแบบทั้งบน **Desktop Web** และ **Mobile PWA (Progressive Web App)** 

ระบบเชื่อมต่อกับระบบยืนยันตัวตนกลาง **Window Asia Central IAM (Mode A: Cloud Two-Way)** อย่างสมบูรณ์แบบตามข้อกำหนดมาตรฐานกลาง **v2.15.0** ผ่าน OAuth 2.0 (PKCE S256) และ RS256 JWKS มีระบบกู้คืนฉุกเฉิน (Break-Glass Mode), ระบบป้องกันบอท 3 ชั้น (3-Layer In-App Bot Defense), ระบบหมุนเวียนรหัสผ่านท้องถิ่น 90 วัน, ระบบตัดเซสชันอัตโนมัติแบบกำหนดเวลาได้รายแอป (**Configurable Per-App Idle Timeout + Dual-Timer Session Architecture**), การบังคับบันทึก **Client IP Address** ใน `transaction_logs` ทุกเหตุการณ์, ผู้ช่วยอัจฉริยะ **WorkSync Copilot (In-App AI)** แบบ Multi-Provider และระบบสรุปงานประจำวันผ่านอีเมล (Daily Email Digest)

### 🛠️ เทคโนโลยีหลักในระบบ (Tech Stack)
- **Backend API:** NestJS 10/11 (TypeScript), Prisma ORM v5.22.0
- **Database:** PostgreSQL 16
- **Frontend:** Next.js 14 (App Router, React 18, TypeScript, Tailwind CSS, Recharts, SheetJS `xlsx`)
- **Real-Time Engine:** Server-Sent Events (SSE) Stream + Visibility-Aware Window Focus Sync
- **Email Engine:** Nodemailer + SMTP Config (Zero `.env` Dynamic Settings ผ่านฐานข้อมูล)
- **Audio & Visual FX:** Web Audio API Sound Synthesizer + HTML5 Canvas Confetti (Zero External Audio Assets)
- **Authentication & Security:**
  - Window Asia Central IAM (OIDC / OAuth 2.0 PKCE + RS256 JWKS, Framework Handshake `2.15.0`)
  - รองรับทั้ง **SP-Initiated SSO** และ **IdP-Initiated Portal Launch** (RFC 9700 Compliant Bounce via `/auth/start`)
  - Dual-Timer Session Security (Hard Limit `ciam_session_ttl_minutes` + Sliding Idle Timeout `ciam_idle_timeout_minutes` + Warning Countdown `ciam_idle_warning_seconds`)
  - Local Database Credentials (JWT) พร้อม 90-Day Forced Password Rotation & Global Guard
  - 3-Layer In-App Bot Defense (Rate Limiter 10 req/min + Honeypot Decoy + Timing Velocity Guard)
  - Active Directory Gateway (Fallback สำหรับ Break-Glass Mode)
  - 6-Digit PIN Code สำหรับ Quick Authentication บน Mobile
  - Mandatory Audit Trail Client IP Logging (`transaction_logs.ip_address`)
- **AI Engine:** WorkSync Copilot Module (Strict Read-Only 100%, Zero-Training Headers + `store: false`, Multi-Provider: `google`, `openai`, `anthropic`, `ollama`, `custom` + Local Rule-based Intelligence Fallback)
- **Notifications:** In-App Notification Center, `@Mention` System, Telegram Bot API
- **Infrastructure:** Docker & Docker Compose, Traefik Reverse Proxy (บน Hostinger VPS)

---

## 🏗️ 2. สถาปัตยกรรมระบบและเน็ตเวิร์ก (Architecture & Constraints)

### ☁️ Production บน VPS (Hostinger)
```
[User Browser]
       │ HTTPS (:443)
       ▼
[Traefik Proxy] (Hostinger จัดการ ครอบพอร์ต 80 และ 443 ทั้งหมด)
       │ HTTP (:3000) ผ่าน labels: Host(`worksync.windowasia.com`)
       ▼
[worksync-nextjs :3000]  (อยู่บน worksync-network + root_default)
       │ Next.js Rewrites Proxy → http://worksync-api:4000
       ▼
[worksync-api :4000]     (อยู่บน worksync-network เท่านั้น)
       │ Prisma ORM (:5432)
       ▼
[worksync-postgres :5432] (อยู่บน worksync-network เท่านั้น)
```

### 🚨 กฎเหล็กข้อห้ามเรื่อง Network & Ports บน VPS (ตาม AGENTS.md):
1. **ห้ามแมปพอร์ต 80, 443 หรือ 5432 ใน `docker-compose.yml` หลัก** เพราะจะชนกับ Traefik และ PostgreSQL ของ Hostinger
2. ในเน็ตเวิร์ก `root_default` มีคอนเทนเนอร์ชื่อ `api` และ `postgres` ของ Hostinger รันอยู่แล้ว **ห้าม** ใช้ Hostname สั้นว่า `http://api:4000` เด็ดขาด **ต้องใช้ชื่อ `http://worksync-api:4000` เสมอ!**
3. **หลัง Rebuild API Container ต้อง Restart `nextjs-app` เสมอ** เพื่อล้าง DNS Cache เก่าใน Next.js Connection Pool ป้องกันปัญหา `ECONNREFUSED`
4. **ห้ามลบ ทำลาย หรือรีเซ็ตข้อมูลใน Database โดยเด็ดขาด** การปรับโครงสร้างต้องใช้ `npx prisma db push` เท่านั้น ห้ามใช้ `migrate reset` หรือ `down -v`

### 💻 Local Development
- Next.js ถูกแมปพอร์ต **`80:3000`** ผ่านไฟล์ `docker-compose.override.yml` เพื่อให้เปิดทดสอบด้วย `http://localhost` โดยตรง
- ไฟล์ `docker-compose.override.yml` อยู่ใน `.gitignore` เรียบร้อยแล้ว ไม่ถูกส่งขึ้น VPS

---

## 🚀 3. ฟังก์ชันและมาตรฐานที่ได้พัฒนาเสร็จสมบูรณ์ (Implemented Features)

### 1. 🔐 Central IAM v2.15.0 (Mode A: Cloud Two-Way) & Directory Governance
- **Framework Version Handshake (`2.15.0`):** ส่ง `"framework_version": "2.15.0"` และ Header `X-CIAM-Framework-Version: 2.15.0` ใน `GET /api/auth/sso/config` และ `GET /api/v1/directory/accounts`
- **OIDC PKCE S256 & RS256 JWKS:** แลกเปลี่ยน Token และตรวจสอบลายเซ็น ID Token จาก Public Keys ของ Central IAM (`https://ciam.windowasia.com/.well-known/jwks.json`) แบบ Dynamic Caching พร้อมบังคับตรวจสอบ `iss` และ `aud` อย่างเข้มงวด
- **Callback Break-Glass & Origin IP Guard:** บล็อก Callback ด้วย HTTP `503` หากปิด SSO หรือเปิด Break-Glass Mode, แยกบันทึก `ciam_origin_ip` (จาก Claims / Header `X-CIAM-Origin-IP`) คู่กับ `browser_ip` และ `client_ip`
- **Username & Claims Mapping + Case-Insensitive Resolution:** ให้ความสำคัญกับ `preferred_username` ก่อน `sub` และค้นหาบัญชีด้วย `mode: Prisma.QueryMode.insensitive` ทั้ง Username และ Email
- **Least Privilege Auto-Provisioning:** สร้างบัญชีอัตโนมัติในระดับสิทธิ์ต่ำสุด (`Role.USER`) พร้อมดักจับ Race Condition และไม่ปลดล็อกบัญชีที่ถูกระงับสิทธิ์คืนโดยอัตโนมัติ (Inactive Account Guard)
- **Group C Inbound Directory & M2M Hardening:**
  - รองรับทั้ง `/api/v1/directory/*`, `/v1/directory/*` และ Fallback `/api/directory/*`
  - ตรวจสอบ `X-Management-API-Key`, ลำดับ Origin IP (`x-ciam-origin-ip` → `x-origin-ip` → `x-forwarded-for`) และ `X-Request-Timestamp` (±300 วินาที ป้องกัน Replay Attack)
  - รองรับฟิลด์ `password` และ `must_change_password` สำหรับการสร้าง Local Account (`use_ad_auth: false`) จาก Central IAM โดย Hash ด้วย `bcrypt` ลงฐานข้อมูลจริง
  - ป้องกันบัญชีผู้ดูแลระบบฉุกเฉิน (`admin`, `superadmin`, `emergency_admin`, `local_admin`) จากคำสั่งปิดใช้งาน และ Revoke Active Sessions (`SessionActivityService.revokeUserSessions`), `devices`, `pinCode` ทันทีเมื่อระงับสิทธิ์

### 2. ⚡ RFC 9700 Seamless SSO Bounce (`/auth/start`)
- รองรับการเปิดแอปจากการ์ดใน Central IAM Portal หรือระบบภายนอก โดยเด้งผ่าน `/auth/start` เพื่อสร้าง PKCE (`code_verifier`, `code_challenge`, `state`) บันทึกลง Client Session และ Redirect ไปยัง Central IAM อัตโนมัติ พร้อม `useRef` ป้องกัน React StrictMode ยิง Callback ซ้ำ 2 รอบ

### 3. 🔒 Enterprise Local Password Policy & 90-Day Forced Rotation (หมวด G)
- กำหนดความซับซ้อน 6 ประการ: ความยาว 8-16 ตัว, อักษรใหญ่ (`A-Z`), อักษรเล็ก (`a-z`), ตัวเลข (`0-9`), อักขระพิเศษ (`!@#$%^&*...`), ห้ามมี Username ปะปน
- ยกเว้นบัญชี AD/SSO (`is_ad_auth = true`) จากกฎ 90 วัน
- ติดตามผ่าน `password_changed_at` และ `must_change_password` พร้อมแสดงผล `ForcedPasswordChangeModal` ทั้งตอน Login และในระดับ Global App Shell ผ่าน `SessionSecurityGuard` รวมถึงบังคับใช้เกณฑ์ 6 ข้อเดียวกันในหน้าแก้ไขโปรไฟล์ผู้ใช้ (`web/src/app/page.tsx`)

### 4. 🛡️ 3-Layer In-App Bot Defense (หมวด F)
- **Layer 1 (Rate Limit):** Sliding-Window 10 requests/min ต่อ IP คืน Header `Retry-After` พร้อม Bypass IP องค์กร (`127.0.0.1`, `192.168.*`, `10.*`, `172.16-31.*`)
- **Layer 2 (Decoy Honeypots):** ฟิลด์กับดัก `corporate_fax` และ `security_honey` ซ่อนด้วย CSS `left: -9999px` และ `aria-hidden="true"`
- **Layer 3 (Timing Velocity):** ปฏิเสธการส่งฟอร์มที่เร็วกว่ามนุษย์ทั่วไป (`< 400ms`)

### 5. 📱 Responsive Login UI (หมวด 5.2) & Seamless Logout (หมวด 5.3)
- **Desktop:** แสดงปุ่ม SSO ขนาดกะทัดรัดด้านบน คั่นด้วย `— หรือเข้าสู่ระบบด้วยชื่อผู้ใช้งาน —` ตามด้วยฟอร์ม Username & Password
- **Mobile:** แสดงฟอร์ม Username & Password ดั้งเดิมเด่นชัด 100% เป็น Primary CTA และมีปุ่ม SSO ขนาดย่อมด้านล่างสุด
- **Seamless Logout & Global 401 Interceptor:** ผู้ใช้ SSO ออกจากระบบกลับ `https://ciam.windowasia.com/portal`, ผู้ใช้ Local กลับ `/login` และ `fetchJSON`/`getMe` แยกจัดการ Header `X-Session-Expired: idle_timeout` เพื่อพาไป `/login?reason=idle_timeout&redirect_uri=...`

### 6. 🤖 WorkSync Copilot (In-App AI Assistant) (หมวด E)
- วิดเจ็ต AI Floating Button มุมขวาล่าง (`WorkSyncCopilotWidget`) ตรวจสอบสถานะผ่าน `GET /api/ai/status` และซ่อน Widget 100% เมื่อปิด `ai_copilot_enabled` (ผ่าน Next.js Rewrite `/api/ai/:path*`)
- ทำงานภายใต้นโยบาย **Strict Read-Only 100%** และ RBAC Scoped Parity (ห้ามเพิ่ม/แก้ไข/ลบข้อมูล)
- Privacy Guard: ส่ง Headers ห้ามเก็บและห้ามนำไปเทรน (`X-No-Model-Training: true`, `X-Data-Retention: none`, `X-OpenAI-Data-Usage-Opt-Out: true`, `Cache-Control: no-store...`, `"store": false`) พร้อม DLP Scrubber (`sanitizeContextForPrivacy`)
- รองรับ Multi-Provider จริง (`google`, `openai`, `anthropic`, `ollama`, `custom`) พร้อมโหมด **Local Rule-Based Intelligence** Fallback
- หน้า `/admin/settings` ปรับแต่ง AI Provider, Model, API Key (Masked), Base URL, MCP Tools Toggle และ System Prompt ได้ทันที (บันทึกในหมวด `ai_copilot`)

### 7. 📊 Multi-Perspective Dashboard & Task Management
- แดชบอร์ดผู้บริหาร 4 มิติ (แผนก, โครงการ, ภาระงานทีม, กำหนดส่ง & เสี่ยง)
- แยกมุมมองงานเด็ดขาด: ภาพรวม, งานฉัน, งานที่ฉันมอบหมาย, งานที่เกี่ยวข้อง, Roadmap (Gantt Chart 14/30 วัน)
- Real-Time Live Sync ผ่าน SSE (`/api/items/tasks/stream`) พร้อม Visibility-Aware Window Focus
- Quick Command Palette (`Cmd + K` / `Ctrl + K`) ค้นหาภารกิจ สมาชิก และคำสั่งด่วน
- ส่งออกรายงานเป็นไฟล์ Excel แท้ (`.xlsx`) ผ่าน SheetJS
- บีบอัดรูปภาพด้วย HTML5 Canvas ก่อนอัปโหลด (ลดขนาดรูปจาก 10MB เหลือ ~300KB)

### 8. ✉️ SMTP Config & Daily Email Digest
- ตั้งค่า SMTP แบบ Zero `.env` ใน `/admin/settings` (Host, Port, Sender, Password) พร้อมปุ่มทดสอบส่งอีเมลทันที
- สมาชิกเลือกเปิด/ปิดรับ Daily Email Digest กำหนดเวลา (เช่น `08:30` น.) และเลือกประเภทงานได้ใน Modal โปรไฟล์

### 9. ⏱️ Configurable Idle Session Timeout & Mandatory Audit IP Logging (v2.14.0 – v2.15.0)
- **Dual-Timer Session Architecture:** Hard Limit ตาม `ciam_session_ttl_minutes` (480 นาที = 8 ชม.) ควบคู่ Sliding Idle Limit ตาม `ciam_idle_timeout_minutes` (ค่าเริ่มต้น 30 นาที, ปรับได้ 1–1440 นาที) และ `ciam_idle_warning_seconds` (ค่าเริ่มต้น 60 วินาที, ปรับได้ 10–300 วินาที) ตั้งค่าได้ใน `/admin/settings`
- **Full-Stack Idle Enforcement:** `SessionSecurityGuard` ฝั่ง Frontend (ดัก Activity Events แบบ throttle 1.5s + ซิงก์ข้ามแท็บผ่าน `localStorage` + Warning Countdown Modal + ปุ่ม **[ขยายเวลาใช้งาน]** เรียก `POST /auth/session/ping`) และ `SessionActivityService` + `JwtStrategy` ฝั่ง Backend (Header `X-Session-Expired: idle_timeout` + `POST /auth/logout` + Event Log **TO-01** `session_idle_timeout`)
- **Mandatory Audit IP (`transaction_logs.ip_address`):** บังคับบันทึก Client IP จริงทุกธุรกรรมผ่าน `extractClientIp` / `extractCiamOriginIp` (หรือ `'127.0.0.1 (SYSTEM)'` สำหรับงานระบบ) พร้อม Index `idx_trans_logs_ip` และแสดงคอลัมน์ **Client IP** ในตาราง Audit Logs หน้า `/admin/settings`

---

## 🗄️ 4. โครงสร้างฐานข้อมูล (Database Schema)

ไฟล์ Schema: [`api/prisma/schema.prisma`](file:///d:/Python/WorkSync/api/prisma/schema.prisma)

### ฟิลด์และตารางสำคัญ:
- **`users`**:
  - `passwordChangedAt` (DateTime @map("password_changed_at"))
  - `mustChangePassword` (Boolean @default(false) @map("must_change_password"))
  - `isAdAuth` (Boolean @default(false) @map("is_ad_auth"))
  - `emailDigestEnabled`, `emailDigestTime`, `emailDigestTypes`, `lastDigestSentAt`
  - ข้อมูลทั่วไป: `username`, `email`, `role`, `department`, `position`, `status`, `pinCode`, `telegramId`
- **`tasks`**: ภารกิจหลัก, สถานะ (todo, in_progress, review, done), ความคืบหน้า, ผู้รับผิดชอบ, กำหนดส่ง, Checklist (`subtasks`), ความคิดเห็น
- **`notifications`**: การแจ้งเตือน In-App และ Mention (`@username`)
- **`system_settings`**: จัดเก็บ Dynamic Config:
  - Central IAM (`central_iam`): `ciam_base_url`, `ciam_client_id`, `ciam_client_secret`, `ciam_sso_enabled`, `ciam_break_glass_active`, `ciam_ad_gateway_url`, `ciam_m2m_key`, `ciam_auto_provision_group`, `ciam_session_ttl_minutes`, `ciam_idle_timeout_minutes`, `ciam_idle_warning_seconds`
  - In-App AI Copilot (`ai_copilot`): `ai_copilot_enabled`, `ai_provider`, `ai_model`, `ai_api_key`, `ai_base_url`, `ai_system_prompt`, `ai_allow_mcp_tools`
  - SMTP Email (`email`): `smtp_host`, `smtp_port`, `smtp_sender_email`, `smtp_password`
- **`transaction_logs`**: บันทึก Audit Log ความปลอดภัยระดับองค์กร (ISO 27001)
  - มีคอลัมน์บังคับ `ipAddress` (`ip_address VARCHAR(50) NOT NULL DEFAULT '127.0.0.1 (SYSTEM)'`) + Index `idx_trans_logs_ip`
  - รองรับ Event Codes: `SSO-01`..`SSO-04`, `BG-01`..`BG-02`, `CFG-01`, `TO-01` (`session_idle_timeout`), `security_bot`, `security_password`

---

## 📁 5. แผนผังไฟล์สำคัญ (Key Files Map)

```
WorkSync/
├── .agents/
│   └── AGENTS.md                          # กฎระเบียบและข้อจำกัดของระบบทั้งหมด (Mandatory Rules)
├── api/
│   ├── prisma/
│   │   ├── schema.prisma                  # Database Schema (รวม ip_address บน transaction_logs)
│   │   └── seed.js                        # ค่าตั้งต้นระบบ (CIAM + Idle Timeout, AI Copilot, SMTP)
│   └── src/
│       ├── common/
│       │   └── ip.util.ts                 # CIAM_FRAMEWORK_VERSION ('2.15.0') & IP Extraction Utilities
│       ├── ai/                            # WorkSync Copilot Module (In-App AI)
│       │   ├── ai.controller.ts           # /api/settings/ai, /api/settings/ai/test, /api/ai/status, /api/ai/chat
│       │   ├── ai.module.ts
│       │   └── ai.service.ts              # Multi-provider (Google/OpenAI/Anthropic/Ollama/Custom) + Local Fallback
│       ├── auth/                          # ระบบ Authentication & Security
│       │   ├── auth.controller.ts         # login, change-password, session/ping, logout
│       │   ├── auth.service.ts            # formatUser, dynamic TTL login, AD/Local auth, password rotation
│       │   ├── bot-defense.service.ts     # 3-Layer In-App Bot Defense
│       │   ├── ciam-sso.controller.ts     # SSO endpoints: config (+framework_version), authorize-url, callback, break-glass
│       │   ├── ciam-sso.service.ts        # PKCE, JWKS RS256, strict iss/aud, Break-Glass guard, user provisioning
│       │   ├── jwt.strategy.ts            # JWT validation + Server-side Idle Timeout enforcement (TO-01)
│       │   ├── password-policy.ts         # 6-rule complexity & 90-day expiry calculator
│       │   └── session-activity.service.ts# In-memory Dual-Timer session tracking & instant revocation
│       ├── directory/                     # Mode A Inbound Directory Governance (Group C)
│       │   ├── ciam-m2m.guard.ts          # M2M Key + Origin IP Whitelist + X-Request-Timestamp Replay Guard
│       │   ├── directory.controller.ts    # /api/v1/directory & /api/directory fallback
│       │   ├── directory.module.ts
│       │   └── directory.service.ts       # Inventory (+framework_version), Local password provisioning, Offboarding
│       ├── email/                         # ระบบส่งอีเมล SMTP และ Daily Email Digest
│       ├── notifications/                 # In-App Notification Center & Mention Engine
│       ├── settings/                      # Dynamic System Settings (CIAM + Idle Timeout + SMTP)
│       ├── tasks/                         # Task CRUD, Real-Time SSE Stream, Activity
│       ├── transaction-logs/
│       │   └── transaction-logs.service.ts# Audit Trail Service พร้อมบังคับบันทึก ip_address เสมอ
│       └── users/                         # User Profile, Preferences & Management
├── web/
│   ├── next.config.js                     # Rewrites (worksync-api:4000, /api/ai/*, /api/directory/*)
│   ├── public/
│   │   ├── manifest.json                  # PWA Manifest
│   │   └── sw.js                          # Service Worker
│   └── src/
│       ├── app/
│       │   ├── admin/settings/page.tsx    # Admin Settings (CIAM + Idle Timeout, AI Copilot, SMTP, Audit Logs + Client IP)
│       │   ├── auth/callback/page.tsx     # SSO Callback Page (พร้อม useRef StrictMode Guard)
│       │   ├── auth/start/page.tsx        # RFC 9700 Seamless SSO Bounce Endpoint
│       │   ├── login/page.tsx             # Responsive Login UI + Idle Timeout Banner + safe redirect_uri
│       │   ├── layout.tsx                 # Root Layout + SessionSecurityGuard + WorkSyncCopilotWidget
│       │   └── page.tsx                   # หน้าหลัก Dashboard, Command Palette, Live Sync, Profile (6-rule password)
│       ├── components/
│       │   ├── ForcedPasswordChangeModal.tsx  # Modal บังคับเปลี่ยนรหัสผ่านเมื่อครบ 90 วัน
│       │   ├── SessionSecurityGuard.tsx       # Idle Timeout Hook + Warning Countdown Modal + Global 90-Day Guard
│       │   ├── WorkSyncCopilotWidget.tsx      # Floating AI Copilot Widget (ซ่อน 100% เมื่อปิดสวิตช์)
│       │   ├── CommandPalette.tsx         # ค้นหาด่วน & คำสั่งลัด (Cmd+K)
│       │   ├── DashboardView.tsx          # แดชบอร์ดผู้บริหาร 4 มิติ
│       │   ├── GanttView.tsx              # Gantt Chart / Roadmap View
│       │   ├── NotificationCenter.tsx     # กระดิ่งแจ้งเตือน & Unread Badge
│       │   └── TaskDetail.tsx             # รายละเอียดงาน & Checklist & Mention
│       └── lib/
│           ├── api.ts                     # API Client + Global 401 Interceptor + Canvas Image Compression
│           ├── auth.ts                    # Auth Helpers, pingSession, logoutIdleTimeout, SSO Client Calls
│           └── effects.ts                 # Confetti, Web Audio Chime, Haptic Vibration
├── docker-compose.yml                     # Production Docker config (ปลอดพอร์ต 80/443)
├── docker-compose.override.yml            # Local Docker config (map 80:3000 สำหรับ localhost)
├── HANDOFF.md                             # เอกสารส่งต่องานฉบับนี้
└── README.md                              # เอกสารภาพรวมและการติดตั้งโปรเจกต์
```

---

## 🔍 6. ประวัติการแก้ปัญหาและการอัปเกรดล่าสุด (Incident & Upgrade Log)

### 1. Upgrade v2.12.0 → v2.15.0 (27 พฤศจิกายน 2026)
- **AI Copilot Widget & Rewrite Bugs Fixed:** เพิ่ม Next.js rewrite `/api/ai/:path*` และ Endpoint `GET /api/ai/status` พร้อมแก้บั๊กใน `WorkSyncCopilotWidget.tsx` ที่เคย fallback ให้ `enabled = true` แม้ปิดใช้งานใน Settings; แยกหมวดบันทึกตั้งค่าเป็น `ai_copilot` และเพิ่มการเชื่อมต่อจริงสำหรับ `openai`, `anthropic`, `ollama`, `custom`
- **Audit Logs UI & Client IP Compliance:** เพิ่ม `transaction_logs.ip_address` + Index `idx_trans_logs_ip`, แก้ตาราง Audit Logs ใน `/admin/settings` ให้รองรับ camelCase (`createdAt`, `triggeredBy`, `ipAddress`) และเพิ่มคอลัมน์ Client IP
- **API Fallback Hostname Fix:** แก้ fallback URL ใน `web/src/lib/auth.ts` และ `web/src/lib/api.ts` จาก `http://api:4000` เป็น `http://worksync-api:4000` ตามกฎของ `AGENTS.md`

### 2. Incident: กดเข้าจาก Central IAM SSO / Portal แล้วขึ้น "ยืนยันตัวตนไม่สำเร็จ — Internal server error"
- **การวินิจฉัย:**
  1. โครงสร้าง Database บน VPS ขาดคอลัมน์ `password_changed_at` และ `must_change_password`
  2. Next.js connection pool แคช IP เก่าของ `worksync-api` หลัง rebuild ทำให้เกิด `ECONNREFUSED`
  3. `claims` ใน ID Token จาก CIAM บางครั้งมี `sub` เป็น UUID แต่ชื่อผู้ใช้จริงอยู่ใน `preferred_username`
  4. บัญชีผู้ใช้ในระบบมีตัวพิมพ์เล็ก-ใหญ่ไม่ตรงกัน (Case-sensitivity)
- **การแก้ไข:** ดึง `preferred_username` ก่อน `sub`, ใช้ `Prisma.QueryMode.insensitive`, ครอบ try/catch ส่งข้อความ error ชัดเจน และยกเว้นบัญชี AD/SSO จากการบังคับเปลี่ยนรหัสผ่าน 90 วัน

---

## ☁️ 7. คำสั่ง Deploy บนเซิร์ฟเวอร์หลัก (VPS Production)

เมื่อเชื่อมต่อ SSH เข้าสู่ VPS ให้รันคำสั่งเหล่านี้ตามลำดับ:

```bash
# 1. เข้าสู่โฟลเดอร์โปรเจกต์
cd /var/www/Worksync

# 2. ดึงโค้ดล่าสุดจาก Git main
git pull origin main

# 3. Rebuild API Container และอัปเดตโครงสร้าง Database (ข้อมูลเดิมไม่สูญหาย)
docker compose up --build -d api
docker compose exec api npx prisma db push

# 4. Rebuild Frontend Container
docker compose up --build -d nextjs-app

# 5. ⚠️ สำคัญมาก: Restart Next.js เพื่อล้าง DNS Cache ไปยัง api container ใหม่
docker compose restart nextjs-app
```

---

## 🗺️ 8. สิ่งที่ต้องทำต่อ / แผนการพัฒนาในอนาคต (Roadmap & Next Steps)

เมื่อกลับมาพัฒนาต่อ ให้โฟกัสในประเด็นดังต่อไปนี้:

1. **ทดสอบมาตรฐาน Central IAM v2.15.0 บน Production จริง:**
   - ตรวจสอบ `GET /api/auth/sso/config` และ `GET /api/v1/directory/accounts` (จากหน้า `/applications` บน CIAM) ว่าแสดง `"framework_version": "2.15.0"`
   - ทดสอบ **SP-Initiated SSO** (`/login`), **IdP-Initiated Portal Launch** (`/auth/start`) และ **Break-Glass Guard** (`503` เมื่อเปิด Break-Glass)
   - ทดสอบ **Idle Session Timeout** (ปรับค่าทดลองใน `/admin/settings` เช่น `2` นาที) ตรวจดู Warning Countdown Modal, ปุ่ม **"ขยายเวลาใช้งาน"** (`POST /auth/session/ping`), การตัดเซสชันอัตโนมัติ, แบนเนอร์บนหน้า Login และบันทึก **TO-01** (`session_idle_timeout`) ในตาราง Audit Logs
   - ตรวจสอบคอลัมน์ **Client IP** ใน `transaction_logs` บนหน้า `/admin/settings` ว่าบันทึก IP จริงครบถ้วนไม่มี `NULL` หรือว่าง
2. **ตั้งค่า In-App AI Copilot กับ External LLM / Local Ollama:**
   - เข้าหน้า `/admin/settings` หัวข้อ **"🤖 3. ผู้ช่วยอัจฉริยะส่วนตัว (In-App AI Copilot)"**
   - ทดสอบเชื่อมต่อกับ Provider ที่องค์กรเลือกใช้ (`google`, `openai`, `anthropic`, `ollama`, `custom`)
   - *(ต่อยอดในอนาคต)* เชื่อมต่อ **Central IAM Core MCP Server** (`https://ciam.windowasia.com/api/v1/mcp/sse`) เมื่อต้องการให้ AI Copilot ดึงสถานะความปลอดภัยข้ามระบบ
3. **ระบบ Push Notification สำหรับ Mobile PWA:**
   - พิจารณาเพิ่ม Web Push Notification ผ่าน Service Worker เพื่อแจ้งเตือนพนักงานผ่านหน้าจอมือถือเมื่อมีงานใหม่ถูก Assign หรือถูก `@Mention`
4. **ระบบการมอบหมายงานแบบ Subtask Assignee:**
   - ปัจจุบัน Subtasks มีเพียงข้อความและ Checkbox สามารถต่อยอดให้แต่ละ Subtask มี Assignee รายบุคคลแยกย่อยได้
