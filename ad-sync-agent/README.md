# AD Sync Agent — Installation & Deployment Guide

> ติดตั้งบนเซิร์ฟเวอร์ภายในบริษัทที่มีสิทธิ์เชื่อมต่อกับ Active Directory Domain Controller

---

## 📋 ความต้องการ

- Node.js >= 18.x
- เครื่องที่รัน Agent ต้องสามารถ **ping/connect ไปยัง AD Domain Controller** ได้ (port 389 หรือ 636)
- Firewall ภายในบริษัท: เปิด port ที่ Agent ใช้งาน (ค่าเริ่มต้น: `3100`) ให้ Hostinger VPS IP เข้าถึงได้

---

## 🚀 การติดตั้ง

### 1. Clone หรือ Copy โฟลเดอร์ `ad-sync-agent` ไปวางบนเครื่องในออฟฟิศ

```bash
# ตัวอย่าง: copy ไปวางที่ /opt/ad-sync-agent
cp -r ad-sync-agent /opt/ad-sync-agent
cd /opt/ad-sync-agent
```

### 2. ติดตั้ง Dependencies

```bash
npm install --production
```

### 3. สร้างไฟล์ `.env` จาก `.env.example`

```bash
cp .env.example .env
```

แก้ไขค่าใน `.env`:

```env
PORT=3100
AD_URL=ldap://192.168.1.10          # IP ของ Domain Controller
AD_BASE_DN=DC=company,DC=local      # ปรับตาม Domain ของคุณ
AD_BIND_DN=CN=svc-worksync,OU=ServiceAccounts,DC=company,DC=local
AD_BIND_PASSWORD=YourServiceAccountPassword

# Key ต้องตรงกับ AD_SHARED_KEY บน WorkSync (Hostinger)
SHARED_KEY=your-64-char-hex-key-here

# Dedicated IP ของ Hostinger VPS
ALLOWED_IP=185.xx.xx.xx
```

### 4. สร้าง Service Account ใน Active Directory

เปิด **Active Directory Users and Computers** แล้ว:
1. สร้าง User ใหม่ เช่น `svc-worksync` ใน OU `ServiceAccounts`
2. กำหนด Password ที่แข็งแรง + ติ๊ก "Password never expires"
3. ให้สิทธิ์ **Read Only** บน Users OU ที่ต้องการค้นหาเท่านั้น (ไม่ต้องเป็น Domain Admin)

### 5. ทดสอบการทำงาน

```bash
npm start
```

ตรวจสอบที่ browser หรือ curl:
```
GET http://localhost:3100/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "AD Sync Agent",
  "timestamp": "2026-06-13T10:00:00.000Z",
  "ad_url": "ldap://192.168.1.10"
}
```

---

## 🔄 รัน Agent ตลอดเวลา (Production)

### Windows — ใช้ NSSM (Non-Sucking Service Manager)

```cmd
# ดาวน์โหลด NSSM จาก https://nssm.cc
nssm install ADSyncAgent "C:\Program Files\nodejs\node.exe" "C:\opt\ad-sync-agent\index.js"
nssm set ADSyncAgent AppDirectory "C:\opt\ad-sync-agent"
nssm start ADSyncAgent
```

### Linux — ใช้ PM2

```bash
npm install -g pm2
pm2 start index.js --name ad-sync-agent
pm2 startup && pm2 save
```

### Linux — ใช้ systemd

```ini
# /etc/systemd/system/ad-sync-agent.service
[Unit]
Description=WorkSync AD Sync Agent
After=network.target

[Service]
Type=simple
User=nobody
WorkingDirectory=/opt/ad-sync-agent
ExecStart=/usr/bin/node /opt/ad-sync-agent/index.js
Restart=on-failure
EnvironmentFile=/opt/ad-sync-agent/.env

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable ad-sync-agent && systemctl start ad-sync-agent
```

---

## 🔐 Generating the Pre-Shared Key (SHARED_KEY)

รันคำสั่งนี้บน Node.js เพื่อสร้าง key ที่มีความปลอดภัยสูง:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**คัดลอก output ไปใส่:**
- `SHARED_KEY=` ใน `.env` ของ AD Sync Agent (บนเครื่องในออฟฟิศ)
- `AD_SHARED_KEY=` ใน `.env` ของ WorkSync API (บน Hostinger VPS)

> ⚠️ **สำคัญ**: Key ทั้งสองฝั่งต้องเหมือนกันทุกตัวอักษร ห้าม Share key นี้ทาง Email หรือช่องทางที่ไม่ปลอดภัย

---

## 🛡️ Security Checklist

- [ ] ติ๊กว่า `ALLOWED_IP` ใน `.env` ตั้งค่าถูกต้อง (ไม่ใช่ `*`)
- [ ] ใช้ HTTPS (ตั้ง Reverse Proxy เช่น nginx + Let's Encrypt หน้า Agent)
- [ ] Service Account มีสิทธิ์ Read Only เท่านั้น
- [ ] ไม่ Commit ไฟล์ `.env` ขึ้น Git
- [ ] เปิด Port เฉพาะ Hostinger IP เท่านั้นที่ Firewall ของบริษัท (Defense in depth)

---

## 🧪 ทดสอบ End-to-End (จาก Hostinger)

เมื่อตั้งค่าเสร็จแล้ว ทดสอบด้วย curl จาก Hostinger VPS:

```bash
# สร้าง encrypted payload ด้วย Node.js ก่อน
node -e "
const crypto = require('crypto');
const key = crypto.createHash('sha256').update('YOUR_SHARED_KEY').digest();
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const data = JSON.stringify({ username: 'testuser', password: 'testpass' });
const enc = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
console.log(JSON.stringify({ iv: iv.toString('hex'), encrypted: enc.toString('hex'), authTag: tag.toString('hex') }));
"

# ส่ง curl request
curl -X POST https://YOUR-OFFICE-DOMAIN:3100/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"iv":"...","encrypted":"...","authTag":"..."}'
```
