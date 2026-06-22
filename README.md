# WorkSync — Task Tracking System

ระบบติดตามงานแบบ Real-time สำหรับทีม ใช้ Directus v11 + PostgreSQL 16 + Next.js 14 + Tailwind CSS + PWA

## 📋 Tech Stack

| Component | Technology |
|-----------|------------|
| Backend API | Directus v11 (Headless CMS) |
| Database | PostgreSQL 16 |
| Frontend | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Mobile | PWA (Progressive Web App) |
| Notifications | Telegram Bot API |
| Container | Docker Compose |

## 🚀 Quick Start

### 1. Clone & Setup

```bash
cd D:\Python\WorkSync

# Copy environment file
copy .env.example .env

# Edit .env with your values (especially Telegram tokens)
```

### 2. Start All Services

```bash
docker-compose up -d
```

Services จะรันที่:
- **PostgreSQL:** `localhost:5432`
- **Directus Admin:** `http://localhost:8055/admin`
- **Next.js App:** `http://localhost:3000`

### 3. Setup Directus Collections

1. เปิด `http://localhost:8055/admin`
2. Login ด้วย:
   - Email: `admin@worksync.local`
   - Password: `admin_password_123`

3. สร้าง Collection `tasks`:
   - ไปที่ **Data Model** → **Create Collection**
   - Collection Name: `tasks`
   - Primary Key: `id` (auto)

4. เพิ่ม Fields ใน `tasks`:

| Field Key | Type | Notes |
|-----------|------|-------|
| `title` | String | Required |
| `description` | Text | |
| `progress` | Integer | Min: 0, Max: 100, Default: 0 |
| `deadline` | Date/Time | |
| `status` | Selection | Options: `todo`, `in_progress`, `review`, `done` |
| `assignee` | String | ชื่อพนักงาน |
| `manager` | String | ชื่อผู้จัดการ |
| `collaborators` | JSON | Array ของชื่อผู้ร่วมงาน |
| `avatar_url` | String | URL รูปภาพโปรไฟล์ |

5. สร้าง Collection `task_comments`:
   - Collection Name: `task_comments`
   - Fields:

| Field Key | Type | Relation |
|-----------|------|----------|
| `task` | M2O → tasks | |
| `user` | String | |
| `message` | Text | |

### 4. Access the App

เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

## 📱 Create Telegram Bot

1. เปิด Telegram → ค้นหา `@BotFather`
2. ส่งคำสั่ง `/newbot`
3. ตั้งชื่อและ username
4. เก็บ **Token** ที่ได้
5. สร้าง Group หรือใช้ Chat ส่วนตัว
6. ส่งข้อความให้ Bot ใน Group
7. เปิด `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
8. หา `chat.id` จาก response
9. ใส่ค่าใน `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-xyz...
   TELEGRAM_CHAT_ID=-1001234567890
   ```

## 📁 Project Structure

```
D:\Python\WorkSync\
├── docker-compose.yml          # Docker services
├── .env.example                # Environment template
├── README.md                   # This file
└── app/                        # Next.js Application
    ├── Dockerfile              # Docker build for Next.js
    ├── package.json
    ├── next.config.js          # Next.js config (PWA)
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── .env.local
    ├── public/
    │   └── manifest.json       # PWA manifest
    └── src/
        ├── app/                # App Router
        │   ├── layout.tsx
        │   ├── page.tsx        # Dashboard
        │   ├── tasks/
        │   │   ├── page.tsx    # Task List
        │   │   └── [id]/page.tsx # Task Detail
        │   └── globals.css
        ├── components/
        │   ├── TaskCard.tsx
        │   ├── TeamDashboard.tsx
        │   ├── TaskList.tsx
        │   ├── TaskDetail.tsx
        │   └── CommentSection.tsx
        ├── lib/
        │   └── api.ts          # API Layer (no @directus/sdk)
        └── types/
            └── index.ts        # TypeScript types
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DIRECTUS_URL` | Directus internal URL | `http://localhost:8055` |
| `NEXT_PUBLIC_API_URL` | Directus public URL | `http://localhost:8055` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | - |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID | - |

### Ports

| Service | Port |
|---------|------|
| Next.js | 3000 |
| Directus | 8055 |
| PostgreSQL | 5432 |

## 🎨 Features

- **Dashboard** — Team View แบบการ์ด แสดง progress แต่ละคน
- **Task Management** — CRUD tasks, update progress, change status
- **Comments** — แลกเปลี่ยนความคิดเห็นใน task
- **PWA** — ติดตั้งบนมือถือได้, ทำงาน offline ได้บางส่วน
- **Dark Mode** — รองรับธีมมืด
- **Mobile First** — Responsive design
- **Telegram Notifications** — แจ้งเตือนเมื่อมี task ใหม่ หรือ progress เปลี่ยน

## 🛠 Development

```bash
# Run in development mode
cd app
npm run dev

# Build for production
npm run build
npm start
```

## 📝 API Layer

ระบบใช้ custom API layer ใน `src/lib/api.ts` แทน `@directus/sdk` โดยตรง:

```typescript
// ตัวอย่างการใช้งาน
import { api } from '@/lib/api';

const tasks = await api.getTasks();
const task = await api.getTaskById(id);
await api.createTask({ title: 'New Task', assignee: 'John' });
await api.updateTaskProgress(id, 50);
```

## 🐛 Troubleshooting

### Directus ไม่ขึ้น
```bash
docker-compose logs directus
```

### Database connection error
ตรวจสอบว่า PostgreSQL พร้อมแล้ว:
```bash
docker-compose logs postgres
```

### PWA ไม่ทำงาน
ตรวจสอบว่า `manifest.json` ถูกโหลดที่ `/manifest.json`

## 📄 License

Internal Project — WindowAsia Co., Ltd.
