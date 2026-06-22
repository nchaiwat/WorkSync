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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
