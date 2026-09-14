const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin_password_123', 10);
  console.log('COMPUTED HASH FOR SEED:', hashedPassword);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@waapps.net' },
    update: {
      username: 'admin',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'active',
    },
    create: {
      email: 'admin@waapps.net',
      username: 'admin',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'WorkSync',
      role: 'ADMIN',
      status: 'active',
      department: 'IT',
      position: 'Administrator',
    },
  });
  
  console.log('✅ Seeded default admin user:', admin.email);

  const defaultSettings = [
    { key: 'ciam_base_url', value: 'https://ciam.windowasia.com', description: 'URL หลักของ Central IAM Engine (ห้ามมี / ต่อท้าย)', category: 'central_iam', dataType: 'string' },
    { key: 'ciam_client_id', value: 'worksync-spoke-client', description: 'Client ID ที่ลงทะเบียนไว้ใน Central IAM Portal', category: 'central_iam', dataType: 'string' },
    { key: 'ciam_client_secret', value: 'sec_worksync_oauth_secret_2026', description: 'รหัสลับเฉพาะของระบบลูก (ห้ามส่งคืนค่าเต็มผ่าน GET API)', category: 'central_iam', dataType: 'encrypted' },
    { key: 'ciam_sso_enabled', value: 'true', description: 'สวิตช์หลักเปิด/ปิดการเข้าใช้งานด้วย Central IAM SSO', category: 'central_iam', dataType: 'boolean' },
    { key: 'ciam_break_glass_active', value: 'false', description: 'โหมดปลดระบบฉุกเฉิน (สลับไปล็อกอินตรงด้วย AD Gateway)', category: 'central_iam', dataType: 'boolean' },
    { key: 'ciam_ad_gateway_url', value: 'http://192.168.12.11:3100', description: 'URL เซิร์ฟเวอร์ AD Gateway ภายในองค์กร', category: 'central_iam', dataType: 'string' },
    { key: 'ciam_auto_provision_group', value: 'User', description: 'ชื่อกลุ่มสิทธิ์เริ่มต้นสำหรับพนักงานใหม่ที่ล็อกอินผ่าน SSO ครั้งแรก', category: 'central_iam', dataType: 'string' },
    { key: 'ciam_session_ttl_minutes', value: '480', description: 'อายุ Access Token ของระบบลูก (ค่าแนะนำ: 8 ชั่วโมง / 480 นาที)', category: 'central_iam', dataType: 'integer' },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: {
        key: s.key,
        value: s.value,
        description: s.description,
        category: s.category,
        dataType: s.dataType,
      },
    });
  }
  console.log('✅ Seeded default Central IAM settings');
}

main()

  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
