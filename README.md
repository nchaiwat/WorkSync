# WorkSync — Enterprise Task Tracking & Collaboration System

ระบบบริหารจัดการและติดตามงานภายในองค์กร (Task Tracking & Team Collaboration Platform) สำหรับ Window Asia  
รองรับการทำงานทั้งบน Desktop และ Mobile PWA เชื่อมต่อกับระบบยืนยันตัวตนกลาง **Window Asia Central IAM**

---

## 📋 Tech Stack

| Component | Technology | Description |
|-----------|------------|-------------|
| **Backend API** | NestJS (TypeScript) | Modular REST API with JWT, Central IAM SSO & Prisma ORM |
| **Database** | PostgreSQL 16 | Relational DB with connection pooling |
| **ORM** | Prisma ORM v5.22.0 | Type-safe database client and schema management |
| **Frontend** | Next.js 14 (App Router) | React 18, Server & Client Components, TypeScript |
| **Styling** | Tailwind CSS | Modern responsive design & Dark mode support |
| **Mobile** | Progressive Web App (PWA) | Installable on iOS & Android |
| **Notifications** | Telegram Bot API | Real-time alerts on new tasks & status updates |
| **Identity & SSO** | Window Asia Central IAM | OAuth 2.0 (PKCE S256) + JWKS RS256 + Break-Glass AD Gateway |
| **Reverse Proxy** | Traefik v3 (VPS) | SSL/TLS Termination & Host-based routing |
| **Containers** | Docker & Docker Compose | Containerized microservices |

---

## 🚀 Quick Start (Local Development)

### 1. Requirements
- Node.js 18+ or 20+
- Docker & Docker Desktop

### 2. Setup Environment
```bash
# คัดลอก Environment Template
copy .env.example .env
copy api\.env.example api\.env
```

### 3. Database Schema Push & Seed
```bash
# ซิงค์โครงสร้างตารางเข้า PostgreSQL
cd api
npx prisma db push --accept-data-loss
node prisma/seed.js
cd ..
```

### 4. Start with Docker Compose
```bash
# สร้าง Network จำลอง (สำหรับครั้งแรก)
docker network create root_default

# รันระบบทั้งหมด
docker compose up --build -d
```

- **Next.js Web:** `http://localhost` (พอร์ต 80 ผ่าน `docker-compose.override.yml`)
- **NestJS API:** `http://localhost:4000`
- **PostgreSQL:** `localhost:5432`

---

## ☁️ Deployment Guide (VPS Production)

กรุณาศึกษาคำแนะนำและข้อห้ามอย่างละเอียดใน [`HANDOFF.md`](file:///d:/Python/WorkSync/HANDOFF.md) และ [`.agents/AGENTS.md`](file:///d:/Python/WorkSync/.agents/AGENTS.md)

### ลำดับคำสั่ง Deploy บน VPS:
```bash
# 1. ดึงโค้ดล่าสุด
git pull origin main

# 2. ซิงค์ตารางฐานข้อมูล (ห้ามใช้ prisma migrate เด็ดขาด ข้อมูลจะหาย)
docker compose exec api npx prisma db push --accept-data-loss

# 3. ใส่ข้อมูลเริ่มต้น
docker compose exec api node prisma/seed.js

# 4. Rebuild Container ที่มีการแก้ไข
docker compose up --build -d api
docker compose up --build -d nextjs-app

# ⚠️ สำคัญมาก: ทุกครั้งหลัง Rebuild api ต้อง Restart nextjs-app เสมอ เพื่อล้าง DNS Cache
docker compose restart nextjs-app
```

---

## 🔐 Authentication & Central IAM SSO (v2.0.0 Zero `.env` Edition)

ระบบรองรับ 3 รูปแบบการยืนยันตัวตน:
1. **Central IAM SSO (Primary):**
   - OAuth 2.0 Authorization Code Flow พร้อม PKCE S256
   - ตรวจสอบความถูกต้องของ JWT Access Token ด้วย RS256 JWKS Public Key
   - Auto-Provisioning ผู้ใช้งานใหม่อัตโนมัติพร้อมกำหนด Role เริ่มต้น
2. **Standard Credentials (Clean Login):**
   - เมื่อปิดสวิตช์ SSO ในหน้า Admin (`/admin/settings`) หน้า Login จะเข้าสู่โหมด Clean ทันที
   - ล็อกอินด้วย Username / Email และรหัสผ่านที่บันทึกไว้ใน Local Database
3. **Break-Glass Emergency Panel:**
   - ในกรณีที่ Central IAM มีปัญหาขัดข้อง แอดมินสามารถเปิดโหมดฉุกเฉิน
   - ระบบจะสลับเส้นทางไปตรวจสอบสิทธิ์ผ่าน Active Directory Gateway สำรองภายในองค์กรโดยตรง

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
WorkSync/
├── api/                           # NestJS Backend API
│   ├── prisma/
│   │   ├── schema.prisma          # Prisma Database Schema
│   │   └── seed.js                # Database Initial Seed
│   └── src/
│       ├── auth/                  # Local Auth & Central IAM SSO (PKCE/JWKS)
│       ├── settings/              # Dynamic System Settings (Zero .env)
│       ├── transaction-logs/      # ISO 27001 Security Audit Trails
│       ├── tasks/                 # Task Management CRUD & Workflow
│       └── users/                 # User Management & RBAC
├── web/                           # Next.js 14 Frontend
│   ├── next.config.js             # Rewrites to worksync-api
│   ├── public/                    # Static Assets & PWA Manifest
│   └── src/
│       ├── app/                   # App Router Pages
│       │   ├── admin/settings/    # System Settings & SSO Control Panel
│       │   ├── auth/callback/     # OIDC PKCE Callback Handler
│       │   ├── login/             # Dynamic Zero-Confusion Login
│       │   └── tasks/             # Task Board & Details
│       ├── components/            # Reusable UI Components
│       └── lib/                   # API Client & Auth Helpers
├── docker-compose.yml             # Main Docker Compose (VPS Production)
├── docker-compose.override.yml    # Local Override (Map 80:3000 for localhost)
├── HANDOFF.md                     # เอกสารส่งต่องานฉบับสมบูรณ์
├── Memory.md                      # AI Agent Context & Constraints
└── README.md                      # เอกสารนี้
```

---

## 📄 License

Internal Project — Window Asia Co., Ltd.
