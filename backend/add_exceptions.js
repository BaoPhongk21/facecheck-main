const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'server.js');
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('/api/exceptions')) {
  const exceptionsApi = `
// ─────────── EXCEPTION REQUESTS ───────────
app.get('/api/exceptions', async (req, res) => {
  try {
    const reqs = await prisma.exceptionRequest.findMany({
      include: { employee: { select: { fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const formatted = reqs.map(r => ({
      id: r.id, employeeName: r.employee.fullName, employeeId: r.employeeId, avatarUrl: r.employee.avatarUrl,
      type: r.type, checkTime: r.checkTime, reason: r.reason, status: r.status.toLowerCase(), submittedAt: r.createdAt
    }));
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.post('/api/exceptions', async (req, res) => {
  const { employeeId, type, checkTime, reason } = req.body;
  if (!employeeId || !type || !checkTime) return res.status(400).json({ error: 'Thiếu thông tin yêu cầu' });
  try {
    const exc = await prisma.exceptionRequest.create({
      data: { employeeId, type, checkTime: new Date(checkTime), reason: reason || '', status: 'PENDING' }
    });
    res.json({ message: 'Gửi yêu cầu thành công', exc });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.put('/api/exceptions/:id/approve', adminAuth, async (req, res) => {
  try {
    const exc = await prisma.exceptionRequest.findUnique({ where: { id: req.params.id } });
    if (!exc || exc.status !== 'PENDING') return res.status(400).json({ error: 'Yêu cầu không hợp lệ' });
    
    await prisma.exceptionRequest.update({ where: { id: req.params.id }, data: { status: 'APPROVED' } });
    
    // Thêm vào AttendanceLog
    const now = new Date(exc.checkTime);
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Logic tính đi trễ
    const shifts = await prisma.shift.findMany({ orderBy: { startTime: 'asc' } });
    let isLate = false;
    if (exc.type === 'IN') {
        if (shifts.length > 0) {
          const currentMin = hour * 60 + minute;
          let closestShift = shifts[0];
          let minDiff = Infinity;
          for (const s of shifts) {
            const [sHr, sMin] = s.startTime.split(':').map(Number);
            const startMin = sHr * 60 + sMin;
            let diff = currentMin - startMin;
            if (diff > 720) diff -= 1440;
            else if (diff < -720) diff += 1440;
            if (Math.abs(diff) < minDiff) { minDiff = Math.abs(diff); closestShift = s; }
          }
          const [sHr, sMin] = closestShift.startTime.split(':').map(Number);
          const allowedLate = closestShift.lateAfterMinutes || 0;
          const startMin = sHr * 60 + sMin;
          let checkinDiff = currentMin - startMin;
          if (checkinDiff > 720) checkinDiff -= 1440;
          else if (checkinDiff < -720) checkinDiff += 1440;
          if (checkinDiff > allowedLate) isLate = true;
        } else {
          isLate = hour > 8 || (hour === 8 && minute > 0);
        }
    }
    
    await prisma.attendanceLog.create({
      data: { employeeId: exc.employeeId, type: exc.type, status: isLate ? 'LATE' : 'ON_TIME', checkTime: exc.checkTime, method: 'MANUAL', confidenceScore: 1.0 }
    });
    res.json({ message: 'Đã duyệt yêu cầu bổ sung', exc });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.put('/api/exceptions/:id/reject', adminAuth, async (req, res) => {
  try {
    const exc = await prisma.exceptionRequest.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
    res.json({ message: 'Đã từ chối yêu cầu', exc });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// ─────────── CONFIG (System Settings) ───────────`;

  code = code.replace('// ─────────── CONFIG (System Settings) ───────────', exceptionsApi);
  fs.writeFileSync(file, code);
  console.log('Added Exception Request APIs');
} else {
  console.log('Exception Request APIs already exist');
}
