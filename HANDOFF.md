# WorkSync — Handover & Continuation Guide (HANDOFF.md)
**อัปเดตล่าสุด:** 12 พฤศจิกายน 2026  
**สถานะโปรเจกต์:** Production Ready / Enterprise v2.12.0 (Central IAM v2.12.0 Full Compliance: 90-Day Local Password Policy & Complexity + 3-Layer In-App Bot Defense + In-App AI Copilot + Responsive Login + RFC 9700 Bounce)

---

## 📌 1. ภาพรวมโปรเจกต์ (Project Overview)

**WorkSync** คือระบบบริหารจัดการและติดตามงาน (Task Tracking & Collaboration Platform) แบบ Real-time ที่พัฒนาขึ้นเพื่อตอบโจทย์การทำงานในองค์กร Window Asia รองรับการใช้งานเต็มรูปแบบทั้งบน **Desktop Web** และ **Mobile PWA (Progressive Web App)** 

ระบบเชื่อมต่อกับระบบยืนยันตัวตนกลาง **Window Asia Central IAM** ผ่านมาตรฐาน OAuth 2.0 (PKCE S256) และ JWKS RS256 พร้อมระบบสำรองฉุกเฉิน (Break-Glass Mode), ระบบแจ้งเตือน Real-time และ Telegram Bot รวมถึงระบบสรุปงานประจำวันผ่านอีเมล (Daily Email Digest)

### 🛠️ เทคโนโลยีหลักในระบบ (Tech Stack)
- **Backend API:** NestJS 10 (TypeScript), Prisma ORM v5.22.0
- **Database:** PostgreSQL 16
- **Frontend:** Next.js 14 (App Router, React 18, TypeScript, Tailwind CSS, Recharts, SheetJS `xlsx`)
- **Real-Time Engine:** Server-Sent Events (SSE) Stream + Visibility-Aware Focus Sync
- **Email Engine:** Nodemailer + SMTP Config (Zero `.env` Dynamic Settings)
- **Audio & Visual FX:** Web Audio API Sound Synthesizer + HTML5 Canvas Confetti (Zero External Audio Assets)
- **Authentication:**
  - Window Asia Central IAM (OIDC / OAuth 2.0 PKCE + RS256 JWKS)
  - รองรับทั้ง **SP-Initiated SSO** และ **IdP-Initiated Portal Launch**
  - Local Database Credentials (JWT)
  - Active Directory Gateway (Fallback สำหรับ Break-Glass Mode)
  - 6-Digit PIN Code สำหรับ Quick Authentication
- **Notifications:** In-App Notification Center, `@Mention` System, Telegram Bot API
- **Infrastructure:** Docker & Docker Compose, Traefik Reverse Proxy (บน Hostinger VPS)

---

## 🏗️ 2. สถาปัตยกรรมระบบและเน็ตเวิร์ก (Architecture)

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

> 🚨 **กฎเหล็กข้อห้ามเรื่อง Network & Ports บน VPS:**
> 1. **ห้ามแมปพอร์ต 80, 443 หรือ 5432 ใน `docker-compose.yml` หลัก** เพราะจะชนกับ Traefik และ PostgreSQL ของ Hostinger
> 2. ในเน็ตเวิร์ก `root_default` มี container ชื่อ `api` และ `postgres` ของ Hostinger รันอยู่แล้ว **ห้าม** ใช้ Hostname สั้นว่า `http://api:4000` เด็ดขาด **ต้องใช้ชื่อ `http://worksync-api:4000` เสมอ!**
> 3. **หลัง Rebuild API Container ต้อง Restart `nextjs-app` เสมอ** เพื่อล้าง DNS Cache เก่าใน Next.js Connection Pool

### 💻 Local Development
- Next.js ถูกแมปพอร์ต **`80:3000`** ผ่านไฟล์ `docker-compose.override.yml` เพื่อให้เปิดทดสอบด้วย `http://localhost` โดยตรง
- ไฟล์ `docker-compose.override.yml` อยู่ใน `.gitignore` เรียบร้อยแล้ว ไม่ถูกดันขึ้น VPS

---

## 🚀 3. ฟังก์ชันสำคัญในระบบ (Features & Capabilities)

### 1. 📊 ระบบแดชบอร์ดผู้บริหารหลายมิติ (Multi-Perspective Dashboard)
- สลับดูได้ 4 มุมมองเจาะลึก:
  1. **🏢 แผนก:** สรุปภาระงานแบ่งตามแผนก, กราฟแท่งแนวนอนสัดส่วนสถานะงาน (Todo/Doing/Review/Done) และกดเจาะลึกดูสมาชิกในแผนกได้
  2. **📂 โครงการ:** ติดตามความคืบหน้าของแต่ละ Project Owner พร้อม Donut Chart แสดงอัตราความสำเร็จ
  3. **👥 ภาระงานทีม:** วิเคราะห์ Workload รายบุคคล, คัดกรองผู้ที่มีงานล้นมือ (Overload Warning)
  4. **⏰ กำหนดส่ง & เสี่ยง:** ตรวจสอบงานที่เกินกำหนดส่ง (Overdue) และงานที่ต้องส่งภายใน 48 ชั่วโมง

### 2. 🎯 การแยกมุมมองงานตามสิทธิ์และบทบาท (Strict View Separation)
- **ภาพรวม (Dashboard):** สรุปสถานะภารกิจทั้งหมดในองค์กร
- **งานฉัน (My Tasks):** เฉพาะงานที่ผู้ใช้เป็นผู้รับผิดชอบโดยตรง (`assignee`)
- **มอบหมาย (Assigned by Me):** เฉพาะงานที่ผู้ใช้เป็นคนสร้างและมอบหมายให้ผู้อื่นทำ (ผู้ใต้บังคับบัญชาเลือกเราเป็นผู้จัดการจะไม่ปนเข้ามา)
- **เกี่ยวข้อง (Involved Tasks):** งานที่ผู้ใช้มีส่วนร่วมในฐานะ Manager หรือ Collaborator
- **Roadmap (Gantt View):** แสดงเส้นเวลา Timeline การดำเนินงานและกำหนดส่งของทุกภารกิจ

### 3. ✉️ การตั้งค่าระบบอีเมล SMTP และ Email Digest ประจำวัน
- **Admin System Settings (`/admin/settings`):**
  - ส่วนตั้งค่า `✉️ 2. ตั้งค่าการส่งอีเมล (SMTP Config)`
  - รองรับ Host, Port, Sender Email, Password (พร้อมปุ่ม `👁️ แสดง` / `🙈 ซ่อน`)
  - มีช่องกรอกอีเมลทดสอบ และปุ่ม `✉️ ทดสอบส่ง Email` ทันที
  - บันทึกลงตาราง `system_settings` แบบ Dynamic Zero `.env`
- **User Profile Email Digest:**
  - สมาชิกสามารถเข้าไปเปิด/ปิดรับอีเมลสรุปงานประจำวันได้ใน Modal โปรไฟล์
  - กำหนดเวลาส่งได้เอง (เช่น `08:30` น.)
  - เลือกประเภทงานที่ต้องการให้สรุปได้ (งานฉัน / งานที่เกี่ยวข้อง / งานที่มอบหมาย)
  - Background Cron ตรวจสอบและส่งอีเมลสรุปอัตโนมัติในรูปแบบ Apple Card HTML สวยงาม

### 4. ⚡ Real-Time Live Sync & Auto-Refresh
- มี Endpoint SSE `/api/items/tasks/stream` ส่ง Event ทันทีที่มีการเพิ่ม/แก้/ลบงาน
- Frontend ซิงค์ข้อมูลอัตโนมัติแบบ Real-time โดยไม่ต้องกด F5
- มีระบบตรวจจับ Window Focus เมื่อผู้ใช้สลับแท็บกลับมาจะอัปเดตข้อมูลล่าสุดทันที

### 5. 🔍 Global Quick Search & Command Palette (`Cmd + K` / `Ctrl + K`)
- กดคีย์ลัด `Cmd + K` (Mac) หรือ `Ctrl + K` (Windows) หรือกดปุ่มค้นหาบน Header
- ค้นหาแบบ Fuzzy Search คลุมทั้งชื่องาน, รายละเอียด, ผู้รับผิดชอบ, แผนก, คำสั่งด่วน (สร้างงาน, สลับธีม Dark/Light, เปิดโปรไฟล์)

### 6. 🔔 In-App Notification Center & `@Mention`
- ระบบกระดิ่งแจ้งเตือนบน Header พร้อมตัวเลขนับ Unread Badge สีแดง
- สแกนการแท็ก `@ชื่อ` หรือ `@username` ในคอมเมนต์และรายงานความคืบหน้า แล้วส่งการแจ้งเตือนไปยังผู้ใช้คนนั้นทันที
- คลิกที่การแจ้งเตือนจะเปิดไปยังหน้างายนั้นทันที พร้อมปุ่ม "อ่านทั้งหมด"

### 7. 📈 Gantt Chart / Roadmap View
- แผนภูมิแกนต์แสดงช่วงเวลาการทำงานและกำหนดส่งในกรอบเวลา 14 วัน หรือ 30 วัน
- แถบ Progress Bar แนวนอนตามเปอร์เซ็นต์ความคืบหน้า พร้อมไฮไลต์สีแดงเตือนงานเกินกำหนด

### 8. 📱 PWA (Progressive Web App) & Mobile First UX
- ติดตั้งเป็นแอปบนหน้าจอมือถือได้ (Add to Home Screen) ผ่าน `manifest.json` และ `sw.js`
- **Mobile Header Optimization:**
  - ซ่อนปุ่มงาน 3 อัน ("งานฉัน", "มอบหมาย", "เกี่ยวข้อง") และปุ่ม `+ เพิ่มงาน` จาก Header ด้านบน เพื่อตัดความซ้ำซ้อน
  - เข้าถึงเมนูดังกล่าวได้อย่างสะดวกผ่าน Bottom Navigation Bar ด้านล่าง

### 9. 📥 ส่งออกข้อมูลเป็นไฟล์ Excel แท้ (`.xlsx`)
- ใช้ไลบรารี SheetJS (`xlsx`) ในการแปลงข้อมูลภารกิจทั้งหมดเป็นไฟล์ Spreadsheet `.xlsx`
- ปุ่ม Export ออกแบบเป็น **Icon Excel สีเขียว Emerald** ขนาดกะทัดรัด ประหยัดพื้นที่บน Header

### 10. 🎉 Micro-interactions & Client Image Compression
- ยิงพลุเฉลิมฉลอง Confetti + เสียงสังเคราะห์ Web Audio Chime + ระบบสั่น Haptic เมื่อทำภารกิจหรือ Checklist สำเร็จ 100%
- บีบอัดรูปภาพแนบงานและรูปประจำตัวด้วย HTML5 Canvas อัตโนมัติก่อนอัปโหลด ช่วยลดขนาดไฟล์ภาพถ่ายจาก 8–10MB เหลือเพียง 200–400KB

### 11. 🔒 Enterprise Local Password Policy & 90-Day Forced Rotation (หมวด G / v2.12.0)
- บัญชีท้องถิ่น (Local Accounts) และบัญชีผู้ดูแลระบบฉุกเฉิน ต้องปฏิบัติตามมาตรฐานความซับซ้อน 6 ประการ:
  1. ความยาว 8 - 16 ตัวอักษร
  2. ตัวพิมพ์ใหญ่ (A-Z) >= 1
  3. ตัวพิมพ์เล็ก (a-z) >= 1
  4. ตัวเลข (0-9) >= 1
  5. อักขระพิเศษ (!@#$%^&*...) >= 1
  6. ห้ามมี Username ปะปน
- บังคับหมุนเวียนรหัสผ่านทุกๆ 90 วัน (`(now - password_changed_at) >= 90 days`) หรือเมื่อ `must_change_password = true` โดยบล็อกการเข้าสู่หน้าระบบ และแสดง `ForcedPasswordChangeModal` บังคับเปลี่ยนทันที

### 12. 🛡️ Enterprise In-App Bot Defense 3 ชั้น (หมวด F / v2.10.0)
- **Layer 1:** Sliding-Window IP Rate Limiting (จำกัด 10 req/min ต่อ IP คืน Header `Retry-After: {sec}` พร้อม Whitelist IP องค์กร)
- **Layer 2:** Decoy Honeypot Trap (ฟิลด์ดักบอทซ่อนสายตา `corporate_fax` และ `security_honey` ซ่อนด้วย CSS `left: -9999px` และ `aria-hidden`)
- **Layer 3:** Submission Velocity & Timing Guard (ตรวจจับเวลาการส่งฟอร์ม `delta_ms < 400ms` เพื่อปฏิเสธ Script และ Bot อัตโนมัติ)

### 13. 📱 Responsive Login UI (หมวด 5.2 / v2.12.0)
- **Desktop:** แสดงปุ่ม SSO ขนาดย่อมด้านบนฟอร์ม คั่นด้วย `— หรือเข้าสู่ระบบด้วยชื่อผู้ใช้งาน —` พร้อมแสดงฟอร์มกรอกรหัสผ่านปกติทันที
- **Mobile:** แสดงฟอร์มล็อกอินเดิมเด่นชัด 100% เป็น Primary CTA และมีปุ่ม SSO ขนาดย่อมด้านล่างสุด

### 14. ⚡ RFC 9700 Seamless SSO Bounce (`/auth/start`) & Portal Launch
- รองรับการเปิดแอปจากการ์ดบน Central IAM Portal ผ่าน SSO Start Endpoint (`/auth/start`) ซึ่งจะสร้าง `code_verifier` (PKCE S256) และ `state` ผูกกับเบราว์เซอร์อัตโนมัติ และเด้ง 302 ไปยัง CIAM Authorize URL

### 15. 🤖 In-App AI Copilot ประจำระบบ WorkSync (หมวด E / v2.8.0)
- ระบบผู้ช่วย AI วิเคราะห์และสรุปงานประจำระบบ ทำงานภายใต้นโยบาย **Strict Read-Only & Zero-Training 100%** (ไม่แก้ไขข้อมูล, ไม่นำข้อมูลไป Train โมเดล, แนบ Privacy Headers ครบถ้วน) พร้อม Local Rule-based Intelligence Fallback

---

## 🗄️ 4. โครงสร้างฐานข้อมูล (Database Schema)

ไฟล์ Schema: [`api/prisma/schema.prisma`](file:///d:/Python/WorkSync/api/prisma/schema.prisma)

### ตารางหลักที่สำคัญ:
- **`users`**: ข้อมูลผู้ใช้, สิทธิ์ (`ADMIN`/`USER`), แผนก, Telegram ID, PIN Code, Local Password Policy และ Email Digest:
  - `passwordChangedAt` (DateTime @map("password_changed_at"))
  - `mustChangePassword` (Boolean @map("must_change_password"))
  - `emailDigestEnabled` (Boolean)
  - `emailDigestTime` (String e.g. "08:30")
  - `emailDigestTypes` (Json)
  - `lastDigestSentAt` (DateTime)
- **`notifications`**: การแจ้งเตือน In-App (`userId`, `title`, `message`, `link`, `isRead`, `createdAt`)
- **`tasks`**: ภารกิจหลัก (`title`, `description`, `status`, `progress`, `assignee`, `manager`, `collaborators`, `deadline`, `createdBy`, `isArchived`, `subtasks`, `latestUpdate`)
- **`task_comments`**: ข้อคิดเห็นและการตอบกลับในแต่ละภารกิจ
- **`task_likes`**: ประวัติการกดถูกใจภารกิจ
- **`task_reads`**: ตรวจจับสถานะการเปิดอ่านของผู้ใช้แต่ละคน
- **`system_settings`**: จัดเก็บคอนฟิก Dynamic Zero `.env`:
  - Central IAM: `ciam_base_url`, `ciam_client_id`, `ciam_client_secret`, `ciam_sso_enabled`, `ciam_break_glass_active`, `ciam_ad_gateway_url`, `ciam_m2m_key`
  - AI Copilot: `ai_copilot_enabled`, `ai_provider`, `ai_model`, `ai_api_key`, `ai_base_url`, `ai_system_prompt`, `ai_allow_mcp_tools`
  - SMTP Email: `smtp_host`, `smtp_port`, `smtp_sender_email`, `smtp_password`
- **`transaction_logs`**: บันทึก Audit Log ความปลอดภัย (ISO 27001)

---

## 📋 5. กฎเหล็กและขั้นตอนการ Deploy (Strict Deployment Workflow)

### 🤖 มาตรฐานการทำงานของ AI Agent
1. **Local Build & Test:** ทดสอบบิวด์ระบบฝั่ง Local ทั้งหมดให้มั่นใจว่าไม่มีข้อผิดพลาด (`npm --prefix api run build`, `npm --prefix web run build`)
2. **Automated Git Push:** บันทึกและ Push ขึ้น `origin main` ให้เรียบร้อย
3. **แนบชุดคำสั่ง VPS ที่มี `cd /var/www/Worksync` เสมอ:** เพื่อให้สามารถคัดลอกไปวางรันบน VPS ได้ทันที

### ☁️ คำสั่ง Deploy บน VPS (Production)

```bash
# 1. เข้าสู่โฟลเดอร์โปรเจกต์
cd /var/www/Worksync

# 2. ดึงโค้ดล่าสุดจาก Git
git pull origin main

# 3. Rebuild เฉพาะ Service ที่มีการเปลี่ยนแปลง
docker compose up --build -d api          # กรณีแก้ Backend
docker compose up --build -d nextjs-app   # กรณีแก้ Frontend

# 4. หากมีการแก้ไข prisma/schema.prisma ให้อัปเดต DB (ข้อมูลเดิมไม่สูญหาย)
docker compose exec api npx prisma db push

# 5. ⚠️ สำคัญมาก: หลัง Rebuild API ต้อง Restart Next.js เสมอ (เพื่อล้าง DNS Cache)
docker compose restart nextjs-app
```

---

## 🔍 6. การแก้ไขปัญหาที่พบบ่อย (Troubleshooting & Known Incidents)

| ปัญหา | สาเหตุ | วิธีแก้ไข |
|---|---|---|
| **Login แล้วขึ้น Internal Server Error หรือ ECONNREFUSED** | Next.js จำ IP เดิมของ Container API ที่ถูก rebuild ใหม่ (DNS Cache ค้าง) | รัน `docker compose restart nextjs-app` บน VPS |
| **Port already allocated (80 หรือ 443 หรือ 5432)** | มีการใส่ ports ใน `docker-compose.yml` หลัก ซึ่งชนกับ Traefik หรือ Postgres ของ Hostinger | นำ ports ออกจาก `docker-compose.yml` หลัก แล้วใส่ใน `docker-compose.override.yml` สำหรับ Local เท่านั้น |
| **API Container คุยกับ Next.js ไม่ได้หลัง Deploy** | มีโค้ดเรียก `http://api:4000` ชนกับ container `api` ของ Hostinger | ตรวจสอบว่าใช้ `http://worksync-api:4000` เสมอ |
| **NestJS API ไม่ตอบสนองต่อ Container อื่น** | NestJS bind แค่ `localhost` | ตรวจสอบไฟล์ `main.ts` ต้องเป็น `await app.listen(port, '0.0.0.0');` |
| **ฐานข้อมูลฟ้อง Column ไม่ตรง หรือฟังก์ชันใหม่ Error** | ยังไม่ได้ซิงค์ Prisma Schema ล่าสุดเข้าสู่ DB | รัน `docker compose exec api npx prisma db push` |

---

## 📁 7. แผนผังไดเรกทอรีสำคัญ (Key Files Map)

```
WorkSync/
├── .agents/
│   └── AGENTS.md                          # กฎระเบียบและข้อจำกัดของระบบทั้งหมด
├── api/
│   ├── prisma/
│   │   └── schema.prisma                  # Prisma Schema (User, Task, Notification, SystemSetting)
│   └── src/
│       ├── app.module.ts                  # Root App Module รวมทุก Submodules
│       ├── email/                         # ระบบส่งอีเมล SMTP และ Daily Email Digest
│       │   ├── email.module.ts
│       │   └── email.service.ts
│       ├── notifications/                 # In-App Notification & Mention Service
│       │   ├── notifications.controller.ts
│       │   ├── notifications.module.ts
│       │   └── notifications.service.ts
│       ├── settings/                      # Admin System Settings (CIAM & SMTP)
│       │   ├── settings.controller.ts
│       │   └── settings.service.ts
│       ├── tasks/                         # Task CRUD, Real-Time SSE Stream, Activity
│       │   ├── tasks.controller.ts
│       │   └── tasks.service.ts
│       └── users/                         # User Profile, Avatar, Digest Preferences
│           ├── users.controller.ts
│           └── users.service.ts
├── web/
│   ├── public/
│   │   ├── manifest.json                  # Web App Manifest สำหรับ PWA
│   │   └── sw.js                          # Service Worker
│   └── src/
│       ├── app/
│       │   ├── admin/settings/page.tsx    # Admin Settings (CIAM SSO & SMTP Config UI)
│       │   ├── layout.tsx                 # Root Layout + PWA Registration
│       │   └── page.tsx                   # หน้าหลัก Dashboard, Navigation, Command Palette, Live Sync
│       ├── components/
│       │   ├── CommandPalette.tsx         # ค้นหาด่วน & คำสั่งลัด (Cmd+K)
│       │   ├── DashboardView.tsx          # แดชบอร์ดผู้บริหาร 4 มิติ
│       │   ├── GanttView.tsx              # Gantt Chart / Roadmap View
│       │   ├── NotificationCenter.tsx     # กระดิ่งแจ้งเตือน & Unread Badge
│       │   ├── TaskDetail.tsx             # หน้ารายละเอียดงาน & Checklist & Mention
│       │   └── TeamDashboard.tsx          # การ์ดภารกิจรายบุคคล
│       └── lib/
│           ├── api.ts                     # API Client + Canvas Image Compression
│           ├── auth.ts                    # Authentication & Display Name Helpers
│           ├── effects.ts                 # Confetti, Web Audio Chime, Haptic Vibration
│           └── userMatch.ts               # ระบบ User Matching อัจฉริยะ
├── docker-compose.yml                     # Production Docker config (ปลอดพอร์ต 80/443)
├── docker-compose.override.yml            # Local Docker config (map 80:3000 สำหรับ localhost)
├── HANDOFF.md                             # เอกสารส่งต่องานฉบับนี้
└── README.md                              # เอกสารภาพรวมและการติดตั้งโปรเจกต์
```
