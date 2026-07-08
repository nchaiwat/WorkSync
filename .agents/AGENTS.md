# WorkSync — Project Constraints, Rules & Deployment Guide
# (อัปเดต: 2026-07-08 หลังจาก Production Incident)

เมื่อมีการแก้ไขโค้ดในโปรเจกต์ WorkSync ให้ใช้ลำดับคำสั่ง Git และ Docker ดังต่อไปนี้เพื่อความถูกต้อง ปลอดภัย และไม่ทำให้ข้อมูลเดิมในระบบสูญหาย

---

## 📝 มาตรฐานการตอบกลับของ AI (AI Response Standard)

ทุกครั้งที่มีการแก้ไขโค้ดเสร็จสิ้น ให้เอเจนต์ AI ปฏิบัติดังนี้โดยอัตโนมัติ:
1. **อธิบายอย่างกระชับ** ว่ามีการแก้ไขส่วนใดบ้าง แก้ที่ไฟล์ไหน และผลลัพธ์เป็นอย่างไร
2. **แนบชุดคำสั่ง Git และ Docker** สำหรับฝั่ง **Local** และ **VPS** ทันที เพื่อให้คุณสามารถคัดลอกไปใช้ได้ทันทีโดยไม่ต้องถามซ้ำ

---

## 💻 1. คำสั่งสำหรับเครื่องคอมพิวเตอร์ของคุณ (เครื่อง Local)

### 🌿 ฝั่ง Git (บันทึกและส่งโค้ด)
```bash
# 1. ตรวจสอบสถานะการอัปเดตไฟล์ (สำคัญ: ต้องเห็นไฟล์ที่แก้ไขทุกไฟล์ก่อน commit)
git status

# 2. เพิ่มการเปลี่ยนแปลงทั้งหมด
git add .

# 3. ตรวจสอบอีกครั้งว่า staged ครบ
git status

# 4. บันทึกคำอธิบายการแก้ไข
git commit -m "คำอธิบายการแก้ไขของคุณ"

# 5. อัปโหลดขึ้นสู่ Git Server
git push origin main
```

### 🐳 ฝั่ง Docker & Database (รันระบบเครื่องตัวเอง)
```bash
# 1. สร้างเน็ตเวิร์กจำลอง (รันเฉพาะกรณีพึ่งตั้งเครื่องใหม่หรือเน็ตเวิร์กยังไม่มี)
docker network create root_default

# 2. อัปเดตโครงสร้าง Prisma Schema ล่าสุดเข้าสู่ DB โลคอลโดยตรง (ข้อมูลไม่หาย)
cd api && npx prisma db push && cd ..

# 3. รันตู้คอนเทนเนอร์ระบบโลคอลทั้งหมดพร้อมรีบิวด์
docker compose up --build -d

# 4. สั่งปิดตู้คอนเทนเนอร์ (เมื่อไม่ต้องการใช้งานแล้ว)
docker compose down
```

---

## ☁️ 2. คำสั่งสำหรับเซิร์ฟเวอร์หลัก (VPS)

รันคำสั่งเหล่านี้หลังจากเชื่อมต่อ SSH เข้าไปยัง VPS และเข้าไปที่โฟลเดอร์โปรเจกต์แล้ว:

```bash
# 1. ดึงโค้ดใหม่
git pull origin main

# 2. Rebuild เฉพาะ service ที่แก้ไข (อย่า rebuild ทั้งหมดโดยไม่จำเป็น)
docker compose up --build -d nextjs-app   # กรณีแก้ frontend
docker compose up --build -d api          # กรณีแก้ backend

# ⚠️ สำคัญมาก: หลัง rebuild api → ต้อง restart nextjs ด้วยเสมอ (เพื่อล้าง DNS cache)
docker compose restart nextjs-app

# 3. อัปเดต schema DB (ถ้ามีการเปลี่ยน prisma/schema.prisma)
docker compose exec api npx prisma db push
```

---

## 🏗️ 3. สถาปัตยกรรมระบบ VPS (Architecture)

```
[Browser]
    ↓ HTTPS (Port 443)
[Traefik] ← ครอบ Port 80/443 ทั้งหมดบน VPS (จัดการโดย Hostinger)
    ↓ route Host: worksync.windowasia.com → port 3000
[worksync-nextjs :3000]  ← อยู่บน worksync-network + root_default
    ↓ Next.js Rewrites → http://worksync-api:4000
[worksync-api :4000]     ← อยู่บน worksync-network เท่านั้น
    ↓ Prisma ORM
[worksync-postgres :5432] ← อยู่บน worksync-network เท่านั้น
```

**VPS Networks:**
- `root_default` = เน็ตเวิร์ก Traefik/External ที่ Hostinger จัดการ **มี container ชื่อ `api` และ `postgres` ของ Hostinger อยู่ด้วย**
- `worksync-network` = เน็ตเวิร์กภายในของ WorkSync เท่านั้น

---

## 🚨 4. ข้อห้ามเด็ดขาด (Strict Prohibitions)

### ❌ ห้าม Map Ports ที่ Hostinger ครอบอยู่แล้ว

| Port | ผู้ครอบ | ผลถ้า map | การแก้ไข |
|------|---------|-----------|----------|
| **80** | Traefik (Hostinger) | `Bind failed: port already allocated` | ลบ `ports:` ออกจาก nextjs-app |
| **443** | Traefik (Hostinger) | เดียวกัน | ลบ `ports:` ออกจาก nextjs-app |
| **5432** | Hostinger Docker postgres | `address already in use` | ลบ `ports:` ออกจาก postgres |

```yaml
# ✅ ถูกต้อง: postgres และ nextjs-app ไม่มี ports section เลย
postgres:
  image: postgres:16
  container_name: worksync-postgres
  # ไม่มี ports!

nextjs-app:
  build: ...
  container_name: worksync-nextjs
  # ไม่มี ports! Traefik จัดการเองผ่าน labels
```

---

### ❌ ห้าม ใช้ชื่อ `api` เป็น Hostname เพื่อเชื่อมต่อ Backend

**สาเหตุ:** `worksync-nextjs` อยู่บน **2 networks** (`worksync-network` + `root_default`) Hostinger มี container ชื่อ `api` บน `root_default` ด้วย Docker DNS จึง resolve ชื่อ `api` ไปหา **Hostinger's container (IP ผิด)** แทน WorkSync API

```javascript
// ❌ ห้าม — DNS ชนกับ Hostinger's api container
const backendUrl = 'http://api:4000';

// ✅ ต้องใช้ container name ที่ unique เสมอ
const backendUrl = 'http://worksync-api:4000';
```

```yaml
# ✅ ใน docker-compose.yml ต้องใช้ worksync-api ทั้ง build arg และ runtime env
nextjs-app:
  build:
    args:
      - NEXT_PUBLIC_API_URL=http://worksync-api:4000
  environment:
    NEXT_PUBLIC_API_URL: "http://worksync-api:4000"
```

---

### ❌ ห้าม NestJS listen โดยไม่ระบุ host

```typescript
// ❌ ห้าม: Node.js อาจ bind แค่ localhost ภายใน container → container อื่นเชื่อมไม่ได้
await app.listen(port);

// ✅ ต้องใช้เสมอ: bind ทุก network interface รวมถึง Docker network
await app.listen(port, '0.0.0.0');
```

---

### ❌ ห้าม ใช้ `docker-compose` (v1 แบบ hyphen)

```bash
❌ docker-compose up --build -d
✅ docker compose up --build -d    # v2 เสมอ (มี space ไม่มี -)
```

---

### ❌ ห้าม Rebuild ทั้ง Stack โดยไม่จำเป็น

```bash
# ❌ อย่า rebuild ทุก service ถ้าแก้แค่ frontend หรือ backend อย่างเดียว
docker compose up --build -d

# ✅ ระบุ service ที่เปลี่ยนแปลงเท่านั้น
docker compose up --build -d nextjs-app
docker compose up --build -d api
```

---

### ❌ ห้าม ลบหรือ Reset ข้อมูลฐานข้อมูลโดยไม่ได้รับอนุมัติ

```bash
❌ docker compose down -v          # -v ลบ volumes ทั้งหมด (ข้อมูลหาย)
❌ npx prisma migrate reset        # รีเซ็ต database
❌ DROP TABLE / TRUNCATE (SQL)     # ทำลายข้อมูล
```

---

## ✅ 5. ข้อบังคับ (Mandatory Rules)

### 📌 Rule 1: หลัง Rebuild API ต้อง Restart Next.js เสมอ

```bash
# Rebuild API
docker compose up --build -d api

# ← ต้องทำเสมอ! ไม่งั้น Next.js จะใช้ IP เก่าของ API container
docker compose restart nextjs-app
```

> **เหตุผล:** เมื่อ rebuild api container จะได้ IP ใหม่บน Docker network แต่ Next.js อาจ cache IP เก่าไว้ใน connection pool การ restart จะล้าง cache และ resolve DNS ใหม่

---

### 📌 Rule 2: ตรวจสอบ git status ก่อน Push เสมอ

```bash
git add .
git status   # ← ตรวจให้เห็นไฟล์ที่แก้ทุกไฟล์ใน "Changes to be committed"
git commit -m "..."
git push origin main
```

> ⚠️ บางไฟล์อาจไม่ถูก track โดย git — ถ้าไม่เห็นไฟล์ที่แก้ใน `git status` ให้ตรวจสอบ `.gitignore` ก่อน push

---

### 📌 Rule 3: อัปเดต Database Schema ด้วย prisma db push เท่านั้น

```bash
# VPS
docker compose exec api npx prisma db push   # ข้อมูลเดิมไม่หาย
```

ห้ามใช้ `prisma migrate` เพราะ project นี้ไม่มี migration files

---

### 📌 Rule 4: ไฟล์ .env ต้องดูแลบน VPS แยกต่างหาก

ไฟล์เหล่านี้ **gitignored** — ไม่ sync ผ่าน git ต้องจัดการบน VPS โดยตรง:
- `/var/www/Worksync/.env`
- `/var/www/Worksync/api/.env`

ถ้ามี token หรือ secret ใหม่ ต้องเพิ่มใน `docker-compose.yml` ภาย `environment:` section ด้วย

---

## 🔍 6. Troubleshooting Guide

### ❓ Internal Server Error ตอน Login

```bash
# 1. ดู Next.js logs — ถ้าเห็น ECONNREFUSED แสดงว่า Next.js หา API ไม่เจอ
docker logs worksync-nextjs --tail 20

# 2. ตรวจ IP จริงของ API container
docker inspect worksync-api --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'

# 3. ถ้า IP ไม่ตรงกับใน error log → DNS cache เก่า → restart nextjs
docker compose restart nextjs-app

# 4. ดู API logs หลัง login attempt
docker logs worksync-api --tail 30
```

---

### ❓ Port already allocated เมื่อ docker compose up

```bash
ss -tlnp | grep 5432   # ตรวจ port 5432
ss -tlnp | grep 80     # ตรวจ port 80
# ถ้าถูก Hostinger ครอบ → ลบ ports section ออกจาก docker-compose.yml ทันที
```

---

### ❓ git pull ล้มเหลวเพราะมี local changes บน VPS

```bash
git checkout docker-compose.yml   # คืนค่าไฟล์ที่แก้ชั่วคราวบน VPS
rm -f backup.sql                  # ลบไฟล์ untracked ที่ไม่ต้องการ
git pull origin main
```

---

### ❓ Docker build ใช้ CACHED ทั้งหมด — code ไม่อัปเดต

```bash
# ตรวจว่า git pull ดึงโค้ดใหม่จริง
git log --oneline -3

# ถ้ามี commit ใหม่แต่ build ยัง cached → force rebuild ไม่ใช้ cache
docker compose build --no-cache api
docker compose up -d api
docker compose restart nextjs-app
```

---

### ❓ ECONNREFUSED ตอน Next.js proxy ไปหา API

```bash
# ตรวจ IP จริงของ API
docker inspect worksync-api --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'

# ตรวจว่า compiled code ของ API ฟัง 0.0.0.0 หรือเปล่า
docker exec worksync-api grep "listen" dist/main.js
# ต้องเห็น: await app.listen(port, '0.0.0.0');

# Restart nextjs เพื่อล้าง DNS cache
docker compose restart nextjs-app
```

---

## 📁 7. โครงสร้างไฟล์สำคัญ

```
WorkSync/
├── .agents/
│   └── AGENTS.md              ← ไฟล์นี้ — กฎและข้อห้ามของ Project
├── api/
│   ├── src/main.ts            ← ต้องมี: app.listen(port, '0.0.0.0')
│   ├── prisma/schema.prisma   ← Database schema
│   └── .env                  ← gitignored, ดูแลบน VPS แยก
├── web/
│   ├── next.config.js         ← rewrites ต้องใช้ 'worksync-api' ไม่ใช่ 'api'
│   └── src/
├── docker-compose.yml         ← NEXT_PUBLIC_API_URL=http://worksync-api:4000
└── .env                       ← gitignored, ดูแลบน VPS แยก
```

---

## 🏷️ 8. Container & Network Reference

| Service | Container Name | DNS Hostname ที่ถูกต้อง | Networks |
|---------|---------------|-------------------------|----------|
| PostgreSQL | `worksync-postgres` | `postgres` | worksync-network เท่านั้น |
| NestJS API | `worksync-api` | **`worksync-api`** (ใช้ชื่อนี้เท่านั้น!) | worksync-network เท่านั้น |
| Next.js | `worksync-nextjs` | — | worksync-network + root_default |

> ⚠️ **Hostinger Docker Manager** มี container ชื่อ `api` และ `postgres` อยู่บน `root_default` network — ห้ามใช้ชื่อสั้นเหล่านี้ใน Next.js

---

## ⚠️ กฎเหล็กความปลอดภัยข้อมูล (Data Safety Strict Rule)

* **ห้ามลบ ทำลาย หรือรีเซ็ตข้อมูลใดๆ ในระบบฐานข้อมูล (Database) ของทุกโครงการโดยเด็ดขาด** ไม่ว่าจะเป็นฐานข้อมูลระดับเครื่องจำลอง (Local) หรือระบบจริง (Production)
* **ยกเว้นเพียงกรณีเดียว:** เมื่อผู้ใช้งานสั่งให้ช่วยลบอย่างเป็นลายลักษณ์อักษรในแชทอย่างชัดเจน หรือมีเหตุผลความจำเป็นที่ได้ตกลงและได้รับการยืนยันจากผู้ใช้งานแล้วเท่านั้น
