/**
 * Seed Script - Khởi tạo dữ liệu mẫu cho FaceCheck
 * Chạy: node prisma/seed.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu...\n');

  // =============================================
  // 1. Tạo tài khoản Admin
  // =============================================
  console.log('👤 Đang tạo tài khoản Admin...');
  const passwordHash = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  const hrAdmin = await prisma.admin.upsert({
    where: { username: 'hr' },
    update: {},
    create: {
      username: 'hr',
      passwordHash: await bcrypt.hash('hr123456', 10),
      role: 'HR',
    },
  });

  console.log(`  ✅ Tạo admin: ${superAdmin.username} (SUPER_ADMIN)`);
  console.log(`  ✅ Tạo admin: ${hrAdmin.username} (HR)\n`);

  // =============================================
  // 2. Tạo Phòng Ban
  // =============================================
  console.log('🏢 Đang tạo phòng ban...');
  const departments = [
    'Kỹ thuật & Phát triển',
    'Nhân sự & Hành chính',
    'Kinh doanh & Marketing',
    'Kế toán & Tài chính',
    'Vận hành & Hỗ trợ',
  ];

  const createdDepts = {};
  for (const name of departments) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    createdDepts[name] = dept;
    console.log(`  ✅ Phòng ban: ${name}`);
  }
  console.log();

  // =============================================
  // 3. Tạo Ca làm việc
  // =============================================
  console.log('⏰ Đang tạo ca làm việc...');
  const shifts = [
    { name: 'Ca Sáng', startTime: '08:00', endTime: '12:00', color: 'blue', lateAfterMinutes: 15 },
    { name: 'Ca Chiều', startTime: '13:00', endTime: '17:00', color: 'green', lateAfterMinutes: 15 },
    { name: 'Ca Tối', startTime: '18:00', endTime: '22:00', color: 'purple', lateAfterMinutes: 20 },
    { name: 'Ca Hành Chính', startTime: '08:00', endTime: '17:00', color: 'orange', lateAfterMinutes: 15 },
  ];

  for (const shift of shifts) {
    const s = await prisma.shift.create({ data: shift }).catch(() => null);
    if (s) console.log(`  ✅ Ca: ${shift.name} (${shift.startTime} - ${shift.endTime})`);
  }
  console.log();

  // =============================================
  // 4. Tạo Nhân viên mẫu
  // =============================================
  console.log('👥 Đang tạo nhân viên mẫu...');
  const employeePassword = await bcrypt.hash('123456', 10);

  const employees = [
    {
      employeeCode: 'NV001',
      fullName: 'Nguyễn Văn An',
      email: 'an.nguyen@company.com',
      phone: '0901234567',
      departmentId: createdDepts['Kỹ thuật & Phát triển'].id,
    },
    {
      employeeCode: 'NV002',
      fullName: 'Trần Thị Bình',
      email: 'binh.tran@company.com',
      phone: '0912345678',
      departmentId: createdDepts['Nhân sự & Hành chính'].id,
    },
    {
      employeeCode: 'NV003',
      fullName: 'Lê Minh Cường',
      email: 'cuong.le@company.com',
      phone: '0923456789',
      departmentId: createdDepts['Kinh doanh & Marketing'].id,
    },
    {
      employeeCode: 'NV004',
      fullName: 'Phạm Thị Dung',
      email: 'dung.pham@company.com',
      phone: '0934567890',
      departmentId: createdDepts['Kế toán & Tài chính'].id,
    },
    {
      employeeCode: 'NV005',
      fullName: 'Hoàng Văn Em',
      email: 'em.hoang@company.com',
      phone: '0945678901',
      departmentId: createdDepts['Vận hành & Hỗ trợ'].id,
    },
    {
      employeeCode: '4920',
      fullName: 'Nguyễn Văn Demo',
      email: 'demo@company.com',
      phone: '0999888777',
      departmentId: createdDepts['Kỹ thuật & Phát triển'].id,
    },
  ];

  for (const emp of employees) {
    const created = await prisma.employee.upsert({
      where: { employeeCode: emp.employeeCode },
      update: {},
      create: {
        ...emp,
        passwordHash: employeePassword,
        isActive: true,
      },
    });
    console.log(`  ✅ Nhân viên: ${created.fullName} (Mã: ${created.employeeCode})`);
  }
  console.log();

  // =============================================
  // 5. Tạo cấu hình hệ thống
  // =============================================
  console.log('⚙️  Đang tạo cấu hình hệ thống...');
  const configs = await prisma.systemConfig.findMany();
  if (configs.length === 0) {
    await prisma.systemConfig.create({
      data: {
        hourlyRate: 100000,
        standardHours: 176,
      },
    });
    console.log('  ✅ Cấu hình lương: 100,000 VND/giờ, 176 giờ/tháng\n');
  } else {
    console.log('  ⏭️  Cấu hình đã tồn tại, bỏ qua.\n');
  }

  // =============================================
  // 6. Tạo Thông báo chào mừng
  // =============================================
  console.log('🔔 Đang tạo thông báo...');
  await prisma.notification.create({
    data: {
      title: 'Chào mừng đến với BioHR!',
      content: 'Hệ thống chấm công AI đã sẵn sàng. Hãy đăng ký khuôn mặt để bắt đầu sử dụng.',
    },
  });
  console.log('  ✅ Đã tạo thông báo chào mừng\n');

  // =============================================
  // Tổng kết
  // =============================================
  console.log('='.repeat(50));
  console.log('✅ SEED HOÀN TẤT!');
  console.log('='.repeat(50));
  console.log('\n📋 Thông tin đăng nhập:');
  console.log('  🔑 Admin     | username: admin | password: admin123');
  console.log('  🔑 HR Admin  | username: hr    | password: hr123456');
  console.log('  👤 Nhân viên | mã NV: NV001~NV005, 4920 | password: 123456');
  console.log('\n🌐 Truy cập: http://localhost:5173');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
