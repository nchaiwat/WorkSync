# WorkSync — Handover & Continuation Guide (HANDOFF.md)
**อัปเดตล่าสุด:** 12 พฤศจิกายน 2026 (11:25 น.)  
**สถานะโปรเจกต์:** Production Ready / Central IAM Enterprise Integration Specification v2.12.0 Full Compliance  
**Git Branch:** `main` (Synced with `origin/main`)

---

## 📌 1. ภาพรวมโปรเจกต์ (Project Overview)

**WorkSync** คือระบบบริหารจัดการภารกิจและติดตามงาน (Task Tracking & Enterprise Collaboration Platform) แบบ Real-time ที่พัฒนาขึ้นเพื่อตอบโจทย์การทำงานในองค์กร Window Asia รองรับการใช้งานเต็มรูปแบบทั้งบน **Desktop Web** และ **Mobile PWA (Progressive Web App)** 

ระบบเชื่อมต่อกับระบบยืนยันตัวตนกลาง **Window Asia Central IAM** อย่างสมบูรณ์แบบตามข้อกำหนดมาตรฐานกลาง **v2.12.0** ผ่าน OAuth 2.0 (PKCE S256) และ RS256 JWKS มีระบบกู้คืนฉุกเฉิน (Break-Glass Mode), ระบบป้องกันบอท 3 ชั้น (3-Layer In-App Bot Defense), ระบบหมุนเวียนรหัสผ่านท้องถิ่น 90 วัน, ผู้ช่วยอัจฉริยะ **WorkSync Copilot (In-App AI)** และระบบสรุปงานประจำวันผ่านอีเมล (Daily Email Digest)

### 🛠️ เทคโนโลยีหลักในระบบ (Tech Stack)
- **Backend API:** NestJS 10 (TypeScript), Prisma ORM v5.22.0
- **Database:** PostgreSQL 16
- **Frontend:** Next.js 14 (App Router, React 18, TypeScript, Tailwind CSS, Recharts, SheetJS `xlsx`)
- **Real-Time Engine:** Server-Sent Events (SSE) Stream + Visibility-Aware Window Focus Sync
- **Email Engine:** Nodemailer + SMTP Config (Zero `.env` Dynamic Settings ผ่านฐานข้อมูล)
- **Audio & Visual FX:** Web Audio API Sound Synthesizer + HTML5 Canvas Confetti (Zero External Audio Assets)
- **Authentication & Security:**
  - Window Asia Central IAM (OIDC / OAuth 2.0 PKCE + RS256 JWKS)
  - รองรับทั้ง **SP-Initiated SSO** และ **IdP-Initiated Portal Launch** (RFC 9700 Compliant Bounce via `/auth/start`)
  - Local Database Credentials (JWT) พร้อม 90-Day Forced Password Rotation
  - 3-Layer In-App Bot Defense (Rate Limiter 10 req/min + Honeypot Decoy + Timing Velocity Guard)
  - Active Directory Gateway (Fallback สำหรับ Break-Glass Mode)
  - 6-Digit PIN Code สำหรับ Quick Authentication บน Mobile
- **AI Engine:** WorkSync Copilot Module (Strict Read-Only 100%, Zero-Training Headers, Local Rule-based Intelligence Fallback)
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
4. **ห้ามลบ ทำลาย หรือรีเซ็ตข้อมูลใน Database โดยเด็ดขาด** การปรับโครงสร้างต้องใช้ `npx prisma db push --accept-data-loss` เท่านั้น ห้ามใช้ `migrate reset` หรือ `down -v`

### 💻 Local Development
- Next.js ถูกแมปพอร์ต **`80:3000`** ผ่านไฟล์ `docker-compose.override.yml` เพื่อให้เปิดทดสอบด้วย `http://localhost` โดยตรง
- ไฟล์ `docker-compose.override.yml` อยู่ใน `.gitignore` เรียบร้อยแล้ว ไม่ถูกส่งขึ้น VPS

---

## 🚀 3. ฟังก์ชันและมาตรฐานที่ได้พัฒนาเสร็จสมบูรณ์ (Implemented Features)

### 1. 🔐 Central IAM v2.12.0 Full Integration & SSO
- **OIDC PKCE S256 & RS256 JWKS:** แลกเปลี่ยน Token และตรวจสอบลายเซ็น ID Token จาก Public Keys ของ Central IAM (`https://ciam.windowasia.com/.well-known/jwks.json`) แบบ Dynamic Caching
- **Username & Claims Mapping:** ให้ความสำคัญกับ `preferred_username` (AD Account เช่น `somchai.p`) ก่อน `sub`
- **Case-Insensitive Account Resolution:** ค้นหาผู้ใช้ด้วย `mode: Prisma.QueryMode.insensitive` ทั้ง Username และ Email ป้องกันความคลาดเคลื่อนของตัวพิมพ์เล็ก-ใหญ่
- **Auto-Provisioning with Concurrency Guard:** สร้างบัญชีอัตโนมัติเมื่อพนักงานล็อกอินครั้งแรก พร้อมดักจับ Race Condition หากมีบัญชีอยู่แล้ว
- **AD/SSO Exemption:** ยกเว้นบัญชี AD/SSO (`is_ad_auth = true`) จากกฎการหมดอายุของรหัสผ่านท้องถิ่น 90 วัน เพื่อให้สิทธิ์การจัดการอยู่ที่ Domain Controller / Central IAM

### 2. ⚡ RFC 9700 Seamless SSO Bounce (`/auth/start`)
- รองรับการเปิดแอปจากการ์ดใน Central IAM Portal หรือระบบภายนอก โดยเด้งผ่าน `/auth/start` เพื่อสร้าง PKCE (`code_verifier`, `code_challenge`, `state`) บันทึกลง Client Session และ Redirect ไปยัง Central IAM อัตโนมัติ (Zero-Prompt Login ภายใน ~0.8 วินาที)

### 3. 🔒 Enterprise Local Password Policy & 90-Day Forced Rotation (หมวด G)
- กำหนดความซับซ้อน 6 ประการ: ความยาว 8-16 ตัว, อักษรใหญ่, อักษรเล็ก, ตัวเลข, อักขระพิเศษ, ห้ามมี Username ปะปน
- ติดตามวันเปลี่ยนรหัสผ่านผ่าน `password_changed_at` และ `must_change_password`
- แสดงผล `ForcedPasswordChangeModal` บล็อกการทำงานจนกว่าจะเปลี่ยนรหัสผ่านสำเร็จเมื่อครบกำหนด 90 วัน

### 4. 🛡️ 3-Layer In-App Bot Defense (หมวด F)
- **Layer 1 (Rate Limit):** Sliding-Window 10 requests/min ต่อ IP คืน Header `Retry-After` พร้อม Bypass IP องค์กร (`127.0.0.1`, `192.168.*`, `10.*`, `172.16-31.*`)
- **Layer 2 (Decoy Honeypots):** ฟิลด์กับดัก `corporate_fax` และ `security_honey` ซ่อนด้วย CSS `left: -9999px` และ `aria-hidden="true"`
- **Layer 3 (Timing Velocity):** ปฏิเสธการส่งฟอร์มที่เร็วกว่ามนุษย์ทั่วไป (`< 400ms`)

### 5. 📱 Responsive Login UI (หมวด 5.2)
- **Desktop:** แสดงปุ่ม SSO ขนาดกะทัดรัดด้านบน คั่นด้วย `— หรือเข้าสู่ระบบด้วยชื่อผู้ใช้งาน —` ตามด้วยฟอร์ม Username & Password
- **Mobile:** แสดงฟอร์ม Username & Password ดั้งเดิมเด่นชัด 100% เป็น Primary CTA และมีปุ่ม SSO ขนาดย่อมด้านล่างสุด

### 6. 🤖 WorkSync Copilot (In-App AI Assistant) (หมวด E)
- วิดเจ็ต AI Floating Button มุมขวาล่าง (`WorkSyncCopilotWidget`)
- ทำงานภายใต้นโยบาย **Strict Read-Only 100%** (ตอบคำถาม สรุปงาน วิเคราะห์ความเสี่ยง ห้ามแก้ไขฐานข้อมูล)
- Privacy Guard: ส่ง Headers ห้ามนำข้อมูลไปเทรน (`X-Data-Governance: no-training, confidential`, `X-Read-Only: true`)
- มีโหมด **Local Rule-Based Intelligence** สรุปสถานะภารกิจ งานด่วน และงานค้างได้ทันทีแม้ไม่ได้ต่อ External LLM
- หน้าตั้งค่าระบบ `/admin/settings` สำหรับปรับแต่ง AI Provider, Model, API Key, Base URL และ System Prompt

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
  - Central IAM: `ciam_base_url`, `ciam_client_id`, `ciam_client_secret`, `ciam_sso_enabled`, `ciam_break_glass_active`, `ciam_ad_gateway_url`, `ciam_m2m_key`, `ciam_auto_provision_group`
  - In-App AI Copilot: `ai_copilot_enabled`, `ai_provider`, `ai_model`, `ai_api_key`, `ai_base_url`, `ai_system_prompt`, `ai_allow_mcp_tools`
  - SMTP Email: `smtp_host`, `smtp_port`, `smtp_sender_email`, `smtp_password`
- **`transaction_logs`**: บันทึก Audit Log ความปลอดภัยระดับองค์กร (ISO 27001)

---

## 📁 5. แผนผังไฟล์สำคัญ (Key Files Map)

```
WorkSync/
├── .agents/
│   └── AGENTS.md                          # กฎระเบียบและข้อจำกัดของระบบทั้งหมด (Mandatory Rules)
├── api/
│   ├── prisma/
│   │   ├── schema.prisma                  # Database Schema
│   │   └── seed.js                        # ค่าตั้งต้นระบบ (CIAM, AI Copilot, SMTP)
│   └── src/
│       ├── ai/                            # WorkSync Copilot Module (In-App AI)
│       │   ├── ai.controller.ts           # Endpoints: /api/ai/chat, /api/ai/analyze-task, /api/ai/config
│       │   ├── ai.module.ts
│       │   └── ai.service.ts              # Read-Only logic + Local Intelligence fallback
│       ├── auth/                          # ระบบ Authentication & Security
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts            # formatUser, local login, password expiry check
│       │   ├── bot-defense.service.ts     # 3-Layer In-App Bot Defense
│       │   ├── ciam-sso.controller.ts     # SSO endpoints: config, authorize-url, callback, break-glass
│       │   ├── ciam-sso.service.ts        # PKCE, JWKS RS256 token exchange & user provisioning
│       │   └── password-policy.ts         # 6-rule complexity & 90-day expiry calculator
│       ├── email/                         # ระบบส่งอีเมล SMTP และ Daily Email Digest
│       ├── notifications/                 # In-App Notification Center & Mention Engine
│       ├── settings/                      # Dynamic System Settings
│       ├── tasks/                         # Task CRUD, Real-Time SSE Stream, Activity
│       └── users/                         # User Profile, Preferences & Management
├── web/
│   ├── public/
│   │   ├── manifest.json                  # PWA Manifest
│   │   └── sw.js                          # Service Worker
│   └── src/
│       ├── app/
│       │   ├── admin/settings/page.tsx    # Admin Settings (CIAM, AI Copilot, SMTP Config UI)
│       │   ├── auth/callback/page.tsx     # SSO Callback Page (แลก Token และออก Session)
│       │   ├── auth/start/page.tsx        # RFC 9700 Seamless SSO Bounce Endpoint
│       │   ├── login/page.tsx             # Responsive Login UI (Desktop Compact SSO / Mobile Form First)
│       │   ├── layout.tsx                 # Root Layout + AI Copilot Widget + Password Change Modal
│       │   └── page.tsx                   # หน้าหลัก Dashboard, Navigation, Command Palette, Live Sync
│       ├── components/
│       │   ├── ForcedPasswordChangeModal.tsx  # Modal บังคับเปลี่ยนรหัสผ่านเมื่อครบ 90 วัน
│       │   ├── WorkSyncCopilotWidget.tsx      # Floating In-App AI Copilot Chat Widget
│       │   ├── CommandPalette.tsx         # ค้นหาด่วน & คำสั่งลัด (Cmd+K)
│       │   ├── DashboardView.tsx          # แดชบอร์ดผู้บริหาร 4 มิติ
│       │   ├── GanttView.tsx              # Gantt Chart / Roadmap View
│       │   ├── NotificationCenter.tsx     # กระดิ่งแจ้งเตือน & Unread Badge
│       │   └── TaskDetail.tsx             # รายละเอียดงาน & Checklist & Mention
│       └── lib/
│           ├── api.ts                     # API Client + Canvas Image Compression
│           ├── auth.ts                    # Authentication Helpers & SSO Client Calls
│           └── effects.ts                 # Confetti, Web Audio Chime, Haptic Vibration
├── docker-compose.yml                     # Production Docker config (ปลอดพอร์ต 80/443)
├── docker-compose.override.yml            # Local Docker config (map 80:3000 สำหรับ localhost)
├── HANDOFF.md                             # เอกสารส่งต่องานฉบับนี้
└── README.md                              # เอกสารภาพรวมและการติดตั้งโปรเจกต์
```

---

## 🔍 6. ประวัติการแก้ปัญหาล่าสุด (Incident Resolution Log)

### ปัญหา: กดเข้าจาก Central IAM SSO / Portal แล้วขึ้น "ยืนยันตัวตนไม่สำเร็จ — Internal server error"
- **การวินิจฉัย:**
  1. โครงสร้าง Database บน VPS ยังขาดคอลัมน์ `password_changed_at` และ `must_change_password` เนื่องจากยังไม่ได้รัน `npx prisma db push` บน VPS
  2. Next.js connection pool แคช IP เก่าของ `worksync-api` หลังการ rebuild ทำให้เกิด `ECONNREFUSED`
  3. `claims` ใน ID Token จาก CIAM บางครั้งมี `sub` เป็น UUID แต่ชื่อผู้ใช้จริงอยู่ใน `preferred_username`
  4. บัญชีผู้ใช้ในระบบมีตัวพิมพ์เล็ก-ใหญ่ไม่ตรงกัน (Case-sensitivity)
- **การแก้ไขที่ทำไปแล้ว:**
  - ปรับปรุง [`api/src/auth/ciam-sso.service.ts`](file:///d:/Python/WorkSync/api/src/auth/ciam-sso.service.ts) ดึง `preferred_username` ก่อน `sub`
  - ค้นหาบัญชีผู้ใช้ด้วย `mode: Prisma.QueryMode.insensitive` ทั้ง Username และ Email
  - ครอบ try/catch ทุกจุดใน `handleCallback` เพื่อส่ง Error Message ที่ชัดเจนแทน Internal Server Error ทั่วไป
  - ยกเว้นบัญชี AD/SSO จากการบังคับเปลี่ยนรหัสผ่าน 90 วันใน [`api/src/auth/auth.service.ts`](file:///d:/Python/WorkSync/api/src/auth/auth.service.ts)
  - เพิ่มการดักจับข้อผิดพลาดใน [`web/src/lib/auth.ts`](file:///d:/Python/WorkSync/web/src/lib/auth.ts)

---

## ☁️ 7. คำสั่ง Deploy บนเซิร์ฟเวอร์หลัก (VPS Production)

เมื่อเชื่อมต่อ SSH เข้าสู่ VPS ให้รันคำสั่งเหล่านี้ตามลำดับ:

```bash
# 1. เข้าสู่โฟลเดอร์โปรเจกต์
cd /var/www/Worksync

# 2. ดึงโค้ดล่าสุดจาก Git main
git pull origin main

# 3. อัปเดตโครงสร้าง Database ให้รองรับคอลัมน์ใหม่ล่าสุด (ข้อมูลเดิมไม่สูญหาย)
docker compose exec api npx prisma db push --accept-data-loss

# 4. Rebuild เฉพาะ Service ที่มีการเปลี่ยนแปลง
docker compose up --build -d api
docker compose up --build -d nextjs-app

# 5. ⚠️ สำคัญมาก: Restart Next.js เพื่อล้าง DNS Cache ไปยัง api container ใหม่
docker compose restart nextjs-app
```

---

## 🗺️ 8. สิ่งที่ต้องทำต่อ / แผนการพัฒนาในอนาคต (Roadmap & Next Steps)

เมื่อกลับมาพัฒนาต่อ ให้โฟกัสในประเด็นดังต่อไปนี้:

1. **ทดสอบ Flow การเข้าใช้งาน SSO บน Production จริง:**
   - ทดสอบเปิดใช้งานผ่าน Central IAM Portal (`https://ciam.windowasia.com/portal`)
   - ทดสอบ SP-Initiated Login จากหน้าเว็บ WorkSync เอง (`/login` -> กดปุ่ม Central IAM SSO)
   - ตรวจสอบ Audit Log ในหน้า `/admin/login-logs` ว่ามีการบันทึกประเภท `ciam_sso` สำเร็จครบถ้วน
2. **ตั้งค่า In-App AI Copilot กับ External LLM Provider:**
   - เข้าหน้า `/admin/settings` หัวข้อ **"🤖 3. ตั้งค่าระบบปัญญาประดิษฐ์ (AI Copilot Engine)"**
   - กรอก API Key เช่น Google Gemini, OpenAI หรือ DeepSeek เพื่อทดสอบการวิเคราะห์งานระดับสูงผ่าน LLM จริง
3. **ระบบ Push Notification สำหรับ Mobile PWA:**
   - พิจารณาเพิ่ม Web Push Notification ผ่าน Service Worker เพื่อแจ้งเตือนพนักงานผ่านหน้าจอมือถือเมื่อมีงานใหม่ถูก Assign หรือถูก `@Mention`
4. **ระบบการมอบหมายงานแบบ Subtask Assignee:**
   - ปัจจุบัน Subtasks มีเพียงข้อความและ Checkbox สามารถต่อยอดให้แต่ละ Subtask มี Assignee รายบุคคลแยกย่อยได้
