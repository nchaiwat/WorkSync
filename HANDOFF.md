# WorkSync — Handover & Continuation Guide (HANDOFF.md)
**อัปเดตล่าสุด:** 15 กันยายน 2026  
**สถานะโปรเจกต์:** Production Ready / Central IAM SSO v2.0.0 Integration Complete

---

## 📌 1. ภาพรวมโปรเจกต์ (Project Overview)

**WorkSync** คือระบบบริหารจัดการและติดตามงาน (Task Tracking & Collaboration Platform) แบบ Real-time สำหรับทีมงานภายในองค์กร Window Asia รองรับทั้ง Desktop และ Mobile PWA โดยเชื่อมต่อเข้ากับระบบยืนยันตัวตนกลาง **Window Asia Central IAM** ผ่านมาตรฐาน OAuth 2.0 (PKCE S256) และ JWKS RS256 พร้อมระบบสำรองฉุกเฉิน (Break-Glass Mode)

### 🛠️ เทคโนโลยีหลักในระบบ (Tech Stack)
- **Backend API:** NestJS (TypeScript), Prisma ORM v5.22.0
- **Database:** PostgreSQL 16
- **Frontend:** Next.js 14 (App Router, React 18, TypeScript, Tailwind CSS, PWA)
- **Authentication:** 
  - Central IAM Engine (OIDC / OAuth 2.0 Authorization Code Flow + PKCE S256 + RS256 JWKS)
  - Local Database Credentials (JWT)
  - Active Directory Gateway (Fallback สำหรับ Break-Glass Mode)
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

> ⚠️ **ข้อควรระวังเรื่อง DNS บน VPS:**  
> ในเน็ตเวิร์ก `root_default` มีคอนเทนเนอร์ชื่อ `api` และ `postgres` ของ Hostinger รันอยู่แล้ว  
> **ห้าม** ตั้งชื่อ container หรือเรียกใช้ Hostname สั้นว่า `http://api:4000` โดยเด็ดขาด ต้องใช้ชื่อ **`http://worksync-api:4000`** เสมอ!

### 💻 Local Development
- Next.js ถูกแมปพอร์ต **`80:3000`** ผ่านไฟล์ `docker-compose.override.yml` เพื่อให้เปิดผ่าน `http://localhost` ได้โดยตรง
- ไฟล์ `docker-compose.yml` หลักจะ**ไม่มีการแมปพอร์ต 80 หรือ 443 หรือ 5432** เพื่อป้องกันการชนกับ Traefik บน VPS

---

## 🚀 3. ฟีเจอร์ที่พัฒนาเสร็จสมบูรณ์ล่าสุด (Recent Implementations)

### 🔐 ระบบ Central IAM SSO Integration (v2.0.0 Zero `.env` Standard)
1. **Dynamic Configuration (`system_settings` table):**
   - จัดเก็บการตั้งค่า OIDC (Base URL, Client ID, Secret, Session TTL, Default Group, Enforce SSO Toggle) ในฐานข้อมูล PostgreSQL
   - ปรับเปลี่ยนค่าได้ทันทีผ่านหน้าแอดมิน (`/admin/settings`) โดยไม่ต้อง Restart Container
   - มี In-Memory Cache ช่วยลดภาระฐานข้อมูล
2. **PKCE (Proof Key for Code Exchange):**
   - คำนวณ `code_verifier` (Base64URL) และ `code_challenge` (SHA-256) ป้องกัน Authorization Code Injection
3. **JWKS RS256 Verification:**
   - ดึง Public Key จาก `/.well-known/jwks.json` อัตโนมัติ พร้อม In-Memory Key Caching 1 ชั่วโมง
4. **Auto-Provisioning:**
   - สร้าง User และ Role ให้อัตโนมัติเมื่อพนักงานล็อกอินผ่าน Central IAM ครั้งแรก
5. **Break-Glass Emergency Panel:**
   - เมื่อ Central IAM มีปัญหา แอดมินสามารถเปิดโหมดฉุกเฉินเพื่อส่ง Request ตรงไปยัง AD Gateway ภายในองค์กรได้
6. **Zero-Confusion Login:**
   - เมื่อปิดสวิตช์ SSO (`ciam_sso_enabled = false`) หน้าจอ Login จะเป็น **Clean Standard Login** ทันที ซ่อนปุ่ม SSO และการแจ้งเตือนทั้งหมด
   - สวิตช์ในหน้า Admin เป็นแบบ **Instant Auto-Save Toggle** มี Cache-Busting ป้องกัน Browser/Next.js แคชสถานะ
7. **ISO 27001 Audit Trail (`transaction_logs` table):**
   - บันทึกประวัติ Transaction ทุกครั้ง (`SSO-01` ถึง `SSO-04`, `CFG-01`, `BG-01`, `BG-02`)

---

## 🗄️ 4. โครงสร้างฐานข้อมูล (Database Schema)

ตารางสำคัญที่เพิ่มเข้ามาใหม่ใน `api/prisma/schema.prisma`:
- **`system_settings`**:
  - `key` (String, Unique) — เช่น `ciam_sso_enabled`, `ciam_base_url`, `ciam_client_id`, `ciam_client_secret`
  - `value` (Text) — ค่าคอนฟิก
  - `data_type` (VarChar) — `string`, `boolean`, `integer`, `encrypted`
  - `category` (VarChar) — หมวดหมู่ เช่น `central_iam`
- **`transaction_logs`**:
  - บันทึก Audit Log สำหรับการตรวจสอบความปลอดภัย พร้อม IP, สถานะ, ระยะเวลาประมวลผล และ User ที่ทำรายการ
- **ตารางเดิมของ WorkSync**:
  - `users`, `tasks`, `task_comments`, `task_likes`, `task_reads`, `announcements`

---

## 📋 5. กฎเหล็กและข้อปฏิบัติในการ Deploy (Strict Deployment Rules)

### 🌿 กฎ Git (Local)
```bash
git status
git add .
git status
git commit -m "คำอธิบายงาน"
git push origin main
```

### ☁️ ขั้นตอน Deploy บน VPS (ต้องทำตามลำดับนี้เสมอ)
```bash
# 1. ดึงโค้ดล่าสุด
git pull origin main

# 2. ซิงค์โครงสร้างฐานข้อมูล (ห้ามใช้ prisma migrate เพราะจะทำให้ข้อมูลหาย!)
docker compose exec api npx prisma db push --accept-data-loss

# 3. ใส่ข้อมูลเริ่มต้น (ถ้ามีฟิลด์ใหม่)
docker compose exec api node prisma/seed.js

# 4. Rebuild เฉพาะ Container ที่แก้ไข
docker compose up --build -d api          # กรณีแก้ backend
docker compose up --build -d nextjs-app   # กรณีแก้ frontend

# ⚠️ กฎเหล็กสำคัญ: หลัง Rebuild api ต้อง Restart nextjs-app เสมอ เพื่อล้าง DNS Cache!
docker compose restart nextjs-app
```

---

## 🔍 6. ประวัติปัญหาที่พบบ่อยและวิธีแก้ไข (Troubleshooting & Known Incidents)

| อาการที่พบ | สาเหตุ | วิธีแก้ |
|---|---|---|
| **ขึ้น 500 "Internal Server Error" ตอนกดสลับสวิตช์ SSO แล้วเด้งกลับ** | ฐานข้อมูลบน VPS ยังไม่มีตาราง `system_settings` หรือไม่ได้รัน `db push` | รัน `docker compose exec api npx prisma db push --accept-data-loss` |
| **ปิด SSO แล้ว แต่หน้า Login หรือหน้า Setting ยังแสดงว่าเปิดอยู่** | Next.js หรือเบราว์เซอร์แคชผลลัพธ์ของ API | มีการใส่ Cache-Busting `_t=${Date.now()}` และ `no-store` ใน `web/src/lib/auth.ts` แล้ว และควรรัน `docker compose restart nextjs-app` |
| **Next.js ขึ้น ECONNREFUSED เมื่อเชื่อมต่อไปยัง API** | Next.js จำ IP เดิมของ Container `api` ที่ถูก rebuild ไปแล้ว | สั่ง `docker compose restart nextjs-app` เพื่อรีเซ็ต DNS cache |
| **พอร์ต 80 ชนกันบน VPS** | มีการใส่ `ports: - 80:3000` ใน `docker-compose.yml` หลัก | ลบ `ports:` ออกจากไฟล์หลัก แล้วใส่ใน `docker-compose.override.yml` สำหรับ Local เท่านั้น |

---

## 🗺️ 7. แผนงานและสิ่งที่ต้องทำต่อในอนาคต (Next Steps & Backlog)

1. **การทดสอบ Integration เต็มรูปแบบกับ Central IAM Portal จริง:**
   - นำ Client ID และ Client Secret ที่ได้จาก Central IAM มาใส่ในหน้า `/admin/settings`
   - ทดสอบกดปุ่ม "⚡ ทดสอบการเชื่อมต่อไปยัง Central IAM" ในหน้าการตั้งค่า
   - ทดสอบการล็อกอินจริงผ่าน Authorization Code Flow
2. **ปรับปรุง UI Dashboard / Task Management:**
   - ตรวจสอบฟังก์ชันการสร้างงาน, การแนบไฟล์ และการแจ้งเตือนผ่าน Telegram ให้ทำงานได้อย่างราบรื่น
3. **Session Revocation & Single Logout (SLO):**
   - รองรับ Front-channel หรือ Back-channel Logout หาก Central IAM มีการยิง Webhook แจ้งเตือนการออกจากระบบ
4. **ทำ Security Hardening เพิ่มเติม:**
   - เข้ารหัส AES-256-GCM สำหรับ `ciam_client_secret` ในตาราง `system_settings` (ปัจจุบันเก็บแบบข้อความปกติโดยใช้ masking บน UI)

---

## 📁 8. แผนผังไดเรกทอรีสำคัญ (Key Files Map)

```
WorkSync/
├── .agents/
│   └── AGENTS.md                          # กฎระเบียบและข้อจำกัดของระบบทั้งหมด
├── api/
│   ├── prisma/
│   │   ├── schema.prisma                  # โมเดลฐานข้อมูล (SystemSetting, TransactionLog ฯลฯ)
│   │   └── seed.js                        # สคริปต์ลงข้อมูลเริ่มต้น
│   └── src/
│       ├── auth/
│       │   ├── ciam-sso.controller.ts     # SSO Auth Controller (Authorize, Callback, Discovery)
│       │   └── ciam-sso.service.ts        # PKCE, JWKS Verification, Auto-Provisioning
│       ├── settings/
│       │   ├── settings.controller.ts     # Admin Settings API
│       │   └── settings.service.ts        # Dynamic Settings & Memory Caching
│       └── transaction-logs/
│           └── transaction-logs.service.ts # ISO 27001 Audit Trail
├── web/
│   ├── next.config.js                     # Rewrites กฎการส่งต่อ Request ไปยัง worksync-api
│   └── src/
│       ├── app/
│       │   ├── admin/settings/page.tsx    # หน้า Admin ตั้งค่า Central IAM, Break-Glass, Logs
│       │   ├── auth/callback/page.tsx     # หน้า Callback รับ Authorization Code
│       │   └── login/page.tsx             # หน้าจอล็อกอิน Clean Standard / SSO / Break-Glass
│       └── lib/
│           └── auth.ts                    # Client API wrapper สำหรับ SSO และ Admin Settings
├── docker-compose.yml                     # Production Docker config (ปลอดพอร์ต 80/443)
├── docker-compose.override.yml            # Local Docker config (map 80:3000 สำหรับ localhost)
├── HANDOFF.md                             # เอกสารส่งต่องานฉบับนี้
├── Memory.md                              # บันทึกความจำหลักของ AI Agent
└── README.md                              # เอกสารภาพรวมและการติดตั้งโปรเจกต์
```
