/**
 * Clear Script - Xoá toàn bộ dữ liệu mẫu, giữ nguyên cấu trúc bảng
 * Chạy: node prisma/clear.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Bắt đầu xoá dữ liệu...\n');

  // Xoá theo thứ tự (các bảng có FK phải xoá trước)
  const r1 = await prisma.notification.deleteMany();
  console.log(`  ✅ Xoá Notification: ${r1.count} bản ghi`);

  const r2 = await prisma.exceptionRequest.deleteMany();
  console.log(`  ✅ Xoá ExceptionRequest: ${r2.count} bản ghi`);

  const r3 = await prisma.leave.deleteMany();
  console.log(`  ✅ Xoá Leave: ${r3.count} bản ghi`);

  const r4 = await prisma.attendanceLog.deleteMany();
  console.log(`  ✅ Xoá AttendanceLog: ${r4.count} bản ghi`);

  const r5 = await prisma.employee.deleteMany();
  console.log(`  ✅ Xoá Employee: ${r5.count} bản ghi`);

  const r6 = await prisma.department.deleteMany();
  console.log(`  ✅ Xoá Department: ${r6.count} bản ghi`);

  const r7 = await prisma.shift.deleteMany();
  console.log(`  ✅ Xoá Shift: ${r7.count} bản ghi`);

  const r8 = await prisma.systemConfig.deleteMany();
  console.log(`  ✅ Xoá SystemConfig: ${r8.count} bản ghi`);

  const r9 = await prisma.admin.deleteMany();
  console.log(`  ✅ Xoá Admin: ${r9.count} bản ghi`);

  console.log('\n==================================================');
  console.log('✅ Xoá dữ liệu hoàn tất! Database hiện đang trống.');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
