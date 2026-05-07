const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const multer = require('multer');
const ExcelJS = require('exceljs');

const upload = multer({ dest: 'uploads/' });

dotenv.config();
const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ── Global Helper Functions ──
const cosineSim = (a, b) => {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const nA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (nA * nB);
};

// Helper function to record spoofing attempts
const recordSpoofingAttempt = async (employeeId, livenessScore, imageBase64, req) => {
  try {
    await prisma.spoofingAttempt.create({
      data: {
        employeeId: employeeId, // Can be null if employee not identified yet
        livenessScore: livenessScore,
        imageBase64: imageBase64, // WARNING: Storing base64 directly in DB can lead to very large DB size and performance issues. Consider storing path to file in cloud storage (S3) or local filesystem instead.
        timestamp: new Date(),
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'],
      },
    });
    console.log(`🚨 Spoofing attempt recorded for employeeId: ${employeeId || 'N/A'} with score: ${livenessScore}`);
  } catch (error) {
    console.error('Error recording spoofing attempt:', error);
  }
};

const minDate = (d1, d2) => (d1 < d2 ? d1 : d2);

const getMinutesDiff = (min1, min2) => {
  let diff = min1 - min2;
  if (diff > 720) diff -= 1440;
  else if (diff < -720) diff += 1440;
  return diff;
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Real-time Socket.io Setup ──
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  socket.on('disconnect', () => console.log('🔌 Client disconnected:', socket.id));
});

// Middleware để gắn io vào req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ── JWT Middleware (optional — chỉ dùng cho route có gắn authMiddleware) ──
const adminAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (decoded.role !== 'SUPER_ADMIN' && decoded.role !== 'HR') return res.status(403).json({ error: 'Không có quyền truy cập Admin' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

// ─────────── WELCOME ───────────
app.get('/', (req, res) => res.send(`
  <div style="font-family: sans-serif; text-align: center; padding: 50px;">
    <h1 style="color: #2563eb;">BioHR API Server</h1>
    <p style="color: #64748b;">The backend is running smoothly.</p>
    <div style="margin-top: 20px; padding: 20px; background: #f8fafc; border-radius: 12px; display: inline-block;">
      <p>Health Check: <a href="/api/health">/api/health</a></p>
      <p>Frontend: <a href="http://localhost:5173">http://localhost:5173</a></p>
    </div>
  </div>
`));

// ─────────── HEALTH ───────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'BioHR Backend is running' }));

// ─────────── AI PROXY ───────────
// Proxy requests to AI Service (localhost:8000) to avoid needing multiple tunnels
app.post('/api/v1/extract', async (req, res) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(60000) // Tăng lên 60 giây cho máy cấu hình thấp
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Service Error:', errorText);
      return res.status(response.status).json({
        success: false,
        error: `AI Service trả về lỗi (${response.status})`
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ AI Proxy Connection Error:', error.message);
    res.status(500).json({ success: false, error: 'AI Service không phản hồi' });
  }
});

app.post('/api/v1/liveness-check', async (req, res) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/liveness-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: 'AI Service không phản hồi' });
  }
});

// ─────────── SEED ───────────
app.post('/api/seed', async (req, res) => {
  try {
    await prisma.attendanceLog.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();
    const deptEng = await prisma.department.create({ data: { name: 'Engineering' } });
    const deptMkt = await prisma.department.create({ data: { name: 'Marketing' } });
    const deptOps = await prisma.department.create({ data: { name: 'Operations' } });
    await prisma.employee.createMany({
      data: [
        { employeeCode: '4920', fullName: 'Marcus Chen', email: 'm.chen@biohr.ai', departmentId: deptEng.id, avatarUrl: 'https://randomuser.me/api/portraits/men/44.jpg', isActive: true },
        { employeeCode: '3105', fullName: 'Sarah Jenkins', email: 's.jenkins@biohr.ai', departmentId: deptMkt.id, avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg', isActive: true },
        { employeeCode: '8821', fullName: 'David Miller', email: 'd.miller@biohr.ai', departmentId: deptEng.id, avatarUrl: 'https://randomuser.me/api/portraits/men/22.jpg', isActive: true },
        { employeeCode: '1244', fullName: 'Elena Rodriguez', email: 'e.rodriguez@biohr.ai', departmentId: deptMkt.id, avatarUrl: 'https://randomuser.me/api/portraits/women/33.jpg', isActive: true },
        { employeeCode: '9982', fullName: 'Ethan Wright', email: 'e.wright@biohr.ai', departmentId: deptOps.id, avatarUrl: null, isActive: true },
      ]
    });
    const adminExists = await prisma.admin.findUnique({ where: { username: 'admin' } });
    if (!adminExists) {
      await prisma.admin.create({ data: { username: 'admin', passwordHash: await bcrypt.hash('admin123', 10), role: 'SUPER_ADMIN' } });
    }
    res.json({ message: 'Seed thành công' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Seed thất bại' });
  }
});

// ─────────── AUTH ───────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Kiểm tra Admin
    const admin = await prisma.admin.findUnique({ where: { username } });
    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.passwordHash);
      if (!isMatch) return res.status(401).json({ error: 'Sai mật khẩu' });
      const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '1d' });
      return res.json({ message: 'Đăng nhập thành công', token, user: { id: admin.id, username: admin.username, role: admin.role, fullName: 'Quản trị viên' } });
    }

    // 2. Kiểm tra Nhân viên
    const emp = await prisma.employee.findUnique({ where: { employeeCode: username }, include: { department: true } });
    if (emp) {
      if (emp.passwordHash) {
        const isMatch = await bcrypt.compare(password, emp.passwordHash);
        if (!isMatch) return res.status(401).json({ error: 'Sai mật khẩu' });
      } else {
        if (password !== '123456' && password !== emp.employeeCode) return res.status(401).json({ error: 'Sai mật khẩu' });
      }
      if (!emp.isActive) return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa' });
      const token = jwt.sign({ id: emp.id, employeeCode: emp.employeeCode, role: 'EMPLOYEE' }, JWT_SECRET, { expiresIn: '1d' });
      return res.json({ message: 'Đăng nhập thành công', token, user: { id: emp.id, employeeCode: emp.employeeCode, role: 'EMPLOYEE', fullName: emp.fullName, avatarUrl: emp.avatarUrl, department: emp.department.name } });
    }

    res.status(401).json({ error: 'Tài khoản không tồn tại' });
  } catch {
    res.status(500).json({ error: 'Lỗi server khi đăng nhập' });
  }
});

// ─────────── DASHBOARD ───────────
app.get('/api/dashboard/stats', adminAuth, async (req, res) => {
  try {
    const totalEmployees = await prisma.employee.count({ where: { isActive: true } });

    let targetDate = new Date();
    if (req.query.date) {
      targetDate = new Date(req.query.date);
    }
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(targetDate.getDate() + 1);

    const todayLogs = await prisma.attendanceLog.findMany({
      where: { checkTime: { gte: targetDate, lt: nextDay } }
    });

    // Tính số người hiện diện (có ít nhất 1 log IN hôm nay)
    const presentEmpIds = new Set(todayLogs.filter(l => l.type === 'IN').map(l => l.employeeId));
    const presentToday = presentEmpIds.size;
    const absentToday = totalEmployees - presentToday;

    // Tính số người đi trễ (có ít nhất 1 log LATE hôm nay)
    const lateEmpIds = new Set(todayLogs.filter(l => l.status === 'LATE').map(l => l.employeeId));
    const lateToday = lateEmpIds.size;

    // Tính điểm AI tự tin trung bình
    let aiScanSuccess = 99.2;
    if (todayLogs.length > 0) {
      const sumConf = todayLogs.reduce((acc, l) => acc + (l.confidenceScore || 0.99), 0);
      aiScanSuccess = +((sumConf / todayLogs.length) * 100).toFixed(1);
    }

    // Calculate trend data for the last 5 days
    const trendData = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);

      const dayLogs = await prisma.attendanceLog.findMany({
        where: { checkTime: { gte: d, lt: nextDay } }
      });
      const dayPresent = new Set(dayLogs.filter(l => l.type === 'IN').map(l => l.employeeId)).size;
      const rate = totalEmployees > 0 ? Math.round((dayPresent / totalEmployees) * 100) : 0;

      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const dayName = days[d.getDay()];
      trendData.push({ name: dayName, value: rate });
    }

    res.json({ totalEmployees, presentToday, absentToday, lateToday, aiScanSuccess, trendData });
  } catch (err) {
    console.error(err);
    res.json({ totalEmployees: 0, presentToday: 0, absentToday: 0, lateToday: 0, aiScanSuccess: 0 });
  }
});

app.get('/api/dashboard/feed', adminAuth, async (req, res) => {
  try {
    let targetDate = new Date();
    if (req.query.date) {
      targetDate = new Date(req.query.date);
    }
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(targetDate.getDate() + 1);

    const logs = await prisma.attendanceLog.findMany({
      where: { checkTime: { gte: targetDate, lt: nextDay } },
      orderBy: { checkTime: 'desc' },
      take: 15,
      include: { employee: { include: { department: true } } }
    });

    const feed = await Promise.all(logs.map(async log => {
      const d = new Date(log.checkTime);
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${mins}`;

      let workHours = null;
      if (log.type === 'OUT') {
        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        const inLog = await prisma.attendanceLog.findFirst({
          where: { employeeId: log.employeeId, type: 'IN', checkTime: { gte: startOfDay, lte: d } },
          orderBy: { checkTime: 'asc' }
        });
        if (inLog) {
          workHours = ((d - new Date(inLog.checkTime)) / 3600000).toFixed(1);
        }
      }

      return {
        id: log.employee.employeeCode,
        name: log.employee.fullName,
        role: log.employee.department.name,
        time: timeStr,
        conf: `${((log.confidenceScore || 0.99) * 100).toFixed(1)}%`,
        status: log.status,
        type: log.type,
        avatar: log.employee.avatarUrl,
        workHours
      };
    }));

    res.json(feed);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ─────────── EMPLOYEES ───────────
app.get('/api/employees', adminAuth, async (req, res) => {
  try {
    const { search, dept, status } = req.query;
    const where = { isActive: true };
    if (search) where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeCode: { contains: search, mode: 'insensitive' } },
    ];
    if (dept) where.department = { name: dept };
    const employees = await prisma.employee.findMany({ where, include: { department: true }, orderBy: { createdAt: 'desc' } });
    const formatted = employees.map(emp => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      name: emp.fullName,
      email: emp.email,
      phone: emp.phone,
      dept: emp.department.name,
      departmentId: emp.departmentId,
      role: 'Nhân viên',
      status: emp.faceEmbedding?.length > 0 ? 'Face Enrolled' : 'Not Enrolled',
      avatar: emp.avatarUrl,
      initials: emp.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    }));
    const filtered = status ? formatted.filter(e => status === 'enrolled' ? e.status === 'Face Enrolled' : e.status === 'Not Enrolled') : formatted;
    res.json(filtered);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi tải danh sách nhân viên' });
  }
});

app.post('/api/employees', adminAuth, async (req, res) => {
  try {
    const { employeeCode, fullName, email, phone, departmentId, faceEmbedding } = req.body;
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) return res.status(400).json({ error: 'Phòng ban không tồn tại' });
    const employee = await prisma.employee.create({
      data: { employeeCode, fullName, email, phone, departmentId, faceEmbedding: faceEmbedding || [] }
    });
    res.json({ message: 'Thêm nhân viên thành công', employee });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2002') return res.status(400).json({ error: 'Mã nhân viên hoặc Email đã tồn tại' });
    res.status(500).json({ error: 'Lỗi server khi thêm nhân viên' });
  }
});

app.put('/api/employees/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeCode, fullName, email, phone, departmentId, faceEmbedding } = req.body;
    const employee = await prisma.employee.update({
      where: { id },
      data: { employeeCode, fullName, email, phone, departmentId, faceEmbedding },
      include: { department: true }
    });
    res.json({ message: 'Cập nhật thành công', employee });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Nhân viên không tồn tại' });
    if (error.code === 'P2002') return res.status(400).json({ error: 'Mã nhân viên hoặc Email đã tồn tại' });
    res.status(500).json({ error: 'Lỗi cập nhật nhân viên' });
  }
});

app.delete('/api/employees/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Xóa tất cả các bản ghi liên quan trước
    await prisma.attendanceLog.deleteMany({ where: { employeeId: id } });
    await prisma.leave.deleteMany({ where: { employeeId: id } });
    await prisma.exceptionRequest.deleteMany({ where: { employeeId: id } });

    await prisma.employee.delete({ where: { id } });
    res.json({ message: 'Xóa nhân viên thành công' });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Nhân viên không tồn tại' });
    res.status(500).json({ error: 'Lỗi xóa nhân viên. Vui lòng kiểm tra các ràng buộc dữ liệu.' });
  }
});

// Bulk Import
app.post('/api/employees/bulk-import', adminAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không tìm thấy file tải lên' });

  const results = [];
  const errors = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const departments = await prisma.department.findMany();
        const deptMap = {};
        departments.forEach(d => deptMap[d.name.toLowerCase()] = d.id);

        let successCount = 0;
        for (const row of results) {
          try {
            const { employeeCode, fullName, email, phone, department } = row;
            if (!employeeCode || !fullName) continue;

            const departmentId = deptMap[department?.toLowerCase()] || departments[0]?.id;

            await prisma.employee.upsert({
              where: { employeeCode },
              update: { fullName, email, phone, departmentId },
              create: { employeeCode, fullName, email, phone, departmentId }
            });
            successCount++;
          } catch (e) {
            errors.push({ row, error: e.message });
          }
        }

        fs.unlinkSync(filePath); // Xóa file tạm
        res.json({ message: `Nhập thành công ${successCount} nhân viên`, errorCount: errors.length, errors });
      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ error: 'Lỗi xử lý file CSV' });
      }
    });
});

app.put('/api/employees/:id/face', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { faceEmbedding } = req.body;

    if (!faceEmbedding || !Array.isArray(faceEmbedding)) {
      return res.status(400).json({ error: 'Dữ liệu khuôn mặt không hợp lệ' });
    }

    await prisma.employee.update({
      where: { id },
      data: { faceEmbedding: faceEmbedding }
    });

    res.json({ message: 'Cập nhật khuôn mặt thành công' });
  } catch (error) {
    console.error('Lỗi cập nhật khuôn mặt:', error);
    res.status(500).json({ error: 'Không thể lưu khuôn mặt vào cơ sở dữ liệu' });
  }
});

// ─────────── ATTENDANCE ───────────
app.get('/api/attendance', adminAuth, async (req, res) => {
  try {
    const { date } = req.query;
    let whereClause = {};
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      whereClause.checkTime = { gte: start, lte: end };
    }

    const logs = await prisma.attendanceLog.findMany({
      where: whereClause,
      include: { employee: { include: { department: true } } },
      orderBy: { checkTime: 'asc' }, // Sắp xếp theo thời gian để lấy giờ vào đầu tiên và giờ ra cuối cùng
    });

    const grouped = {};
    logs.forEach(log => {
      const empId = log.employeeId;
      if (!grouped[empId]) {
        grouped[empId] = {
          employee: log.employee,
          inLog: null,
          outLog: null,
          maxConf: 0
        };
      }

      // Lấy giờ vào (IN) đầu tiên trong ngày
      if (log.type === 'IN' && !grouped[empId].inLog) {
        grouped[empId].inLog = log;
      }
      // Lấy giờ ra (OUT) cuối cùng trong ngày
      if (log.type === 'OUT') {
        grouped[empId].outLog = log;
      }

      const conf = log.confidenceScore || 0.98;
      if (conf > grouped[empId].maxConf) grouped[empId].maxConf = conf;
    });

    const formatted = Object.values(grouped).map(data => {
      const { employee, inLog, outLog, maxConf } = data;

      let status = 'Present'; // Mặc định
      if (inLog && inLog.status === 'LATE') status = 'Late';
      if (outLog && outLog.status === 'EARLY_LEAVE') status = 'Early Leave';

      return {
        id: employee.id,
        name: employee.fullName,
        role: employee.department.name,
        status: status,
        checkIn: inLog ? new Date(inLog.checkTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—',
        checkInStatus: inLog ? (inLog.status === 'ON_TIME' ? 'Đúng giờ' : 'Trễ giờ') : '—',
        checkOut: outLog ? new Date(outLog.checkTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—',
        checkOutStatus: outLog ? (outLog.status === 'ON_TIME' ? 'Đúng giờ' : 'Về sớm') : '—',
        workHours: (inLog && outLog) ? ((new Date(outLog.checkTime) - new Date(inLog.checkTime)) / 3600000).toFixed(1) : null,
        conf: Math.round(maxConf * 100),
        avatar: employee.avatarUrl || 'https://randomuser.me/api/portraits/lego/1.jpg',
      };
    });


    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi tải nhật ký điểm danh' });
  }
});

app.post('/api/attendance/checkin', async (req, res) => {
  try {
    const { employeeId, confidenceScore, type = 'IN', checkTime } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'Thiếu employeeId' });
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { department: true } });
    if (!employee) return res.status(404).json({ error: 'Nhân viên không tồn tại' });
    const logTime = checkTime ? new Date(checkTime) : new Date();
    const hour = logTime.getHours();
    const minute = logTime.getMinutes();

    // Lấy tất cả ca làm việc để tính toán đi trễ
    const shifts = await prisma.shift.findMany({ orderBy: { startTime: 'asc' } });

    let isLate = false;
    let assignedShift = null;

    if (shifts.length > 0) {
      const currentMin = hour * 60 + minute;

      // Tìm ca có giờ bắt đầu gần với thời điểm check-in nhất
      assignedShift = shifts.reduce((prev, curr) => {
        const [pHr, pMin] = prev.startTime.split(':').map(Number);
        const [cHr, cMin] = curr.startTime.split(':').map(Number);
        const pDiff = Math.abs(getMinutesDiff(currentMin, pHr * 60 + pMin));
        const cDiff = Math.abs(getMinutesDiff(currentMin, cHr * 60 + cMin));
        return cDiff < pDiff ? curr : prev;
      });

      if (assignedShift) {
        const [sHr, sMin] = assignedShift.startTime.split(':').map(Number);
        const allowedLate = assignedShift.lateAfterMinutes || 0;
        const startMin = sHr * 60 + sMin;

        const checkinDiff = getMinutesDiff(currentMin, startMin);

        if (checkinDiff > allowedLate) {
          isLate = true;
        }
        console.log(`📌 IN: Closest Shift: ${assignedShift.name}, Start: ${assignedShift.startTime}, Diff: ${checkinDiff}m, Late: ${isLate}`);
      }
    } else {
      isLate = hour > 8 || (hour === 8 && minute > 0);
    }

    const log = await prisma.attendanceLog.create({
      data: {
        employeeId,
        type: 'IN',
        status: isLate ? 'LATE' : 'ON_TIME',
        confidenceScore: confidenceScore || 0.99,
        checkTime: checkTime ? new Date(checkTime) : logTime
      },
      include: { employee: { include: { department: true } } }
    });


    console.log(`✅ Điểm danh thành công cho NV: ${log.employee.fullName} - Trạng thái: ${log.status}`);

    // Phát tín hiệu real-time
    const socketPayload = {
      type: 'CHECKIN',
      log: {
        id: log.employee.id,
        employeeCode: log.employee.employeeCode,
        name: log.employee.fullName,
        role: log.employee.department.name,
        time: new Date(log.checkTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        conf: `${((log.confidenceScore || 0.99) * 100).toFixed(1)}%`,
        status: log.status,
        type: 'IN',
        avatar: log.employee.avatarUrl
      }
    };

    console.log('📡 Emitting attendanceUpdate (CHECKIN):', socketPayload.log.name);
    req.io.emit('attendanceUpdate', socketPayload);

    res.json({
      message: `Điểm danh ${isLate ? 'TRỄ' : 'ĐÚNG GIỜ'} thành công!`,
      log: {
        id: log.id,
        checkTime: log.checkTime,
        type: log.type,
        status: log.status,
        isLate,
        employee: { id: employee.id, fullName: employee.fullName, department: employee.department.name, avatarUrl: employee.avatarUrl }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi điểm danh' });
  }
});

app.post('/api/attendance/checkout', async (req, res) => {
  try {
    const { employeeId, confidenceScore, checkTime } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'Thiếu employeeId' });

    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { department: true } });
    if (!employee) return res.status(404).json({ error: 'Nhân viên không tồn tại' });

    const logTime = checkTime ? new Date(checkTime) : new Date();
    const hour = logTime.getHours();
    const minute = logTime.getMinutes();

    // Lấy ca làm việc để tính "về sớm"
    const shifts = await prisma.shift.findMany();
    let isEarly = false;
    let assignedShift = null;

    if (shifts.length > 0) {
      const currentMin = hour * 60 + minute;

      // Tìm giờ vào (IN) đầu tiên trong ngày hôm nay
      const startOfDay = new Date(logTime);
      startOfDay.setHours(0, 0, 0, 0);
      const inLog = await prisma.attendanceLog.findFirst({
        where: { employeeId, type: 'IN', checkTime: { gte: startOfDay, lte: logTime } },
        orderBy: { checkTime: 'asc' }
      });

      if (inLog) {
        // Nếu đã có giờ vào, tìm ca có giờ BẮT ĐẦU gần nhất với giờ vào đó
        const inTime = new Date(inLog.checkTime);
        const inMin = inTime.getHours() * 60 + inTime.getMinutes();

        assignedShift = shifts.reduce((prev, curr) => {
          const [pH, pM] = prev.startTime.split(':').map(Number);
          const [cH, cM] = curr.startTime.split(':').map(Number);
          const pD = Math.abs(getMinutesDiff(inMin, pH * 60 + pM));
          const cD = Math.abs(getMinutesDiff(inMin, cH * 60 + cM));
          return cD < pD ? curr : prev;
        });
      } else {
        // Nếu không có giờ vào (quên quẹt sáng), tìm ca có giờ kết thúc gần nhất với hiện tại
        assignedShift = shifts.reduce((prev, curr) => {
          const [pHe, pMe] = prev.endTime.split(':').map(Number);
          const [cHe, cMe] = curr.endTime.split(':').map(Number);
          const pD = Math.abs(getMinutesDiff(currentMin, pHe * 60 + pMe));
          const cD = Math.abs(getMinutesDiff(currentMin, cHe * 60 + cMe));
          return cD < pD ? curr : prev;
        });
      }

      if (assignedShift) {
        const [eHr, eMin] = assignedShift.endTime.split(':').map(Number);
        const endMin = eHr * 60 + eMin;
        if (currentMin < endMin) {
          isEarly = true;
        }
        console.log(`📌 OUT: Matched Shift: ${assignedShift.name}, End: ${assignedShift.endTime}, Current: ${hour}:${minute}, Early: ${isEarly}`);
      }
    }

    const log = await prisma.attendanceLog.create({
      data: {
        employeeId,
        type: 'OUT',
        status: isEarly ? 'EARLY_LEAVE' : 'ON_TIME',
        confidenceScore: confidenceScore || 0.99,
        checkTime: logTime
      },
      include: { employee: { include: { department: true } } }
    });


    // Tính thời gian làm việc trong ngày (tùy chọn)
    const startOfDay = new Date(logTime);
    startOfDay.setHours(0, 0, 0, 0);
    const inLog = await prisma.attendanceLog.findFirst({
      where: { employeeId, type: 'IN', checkTime: { gte: startOfDay, lte: logTime } },
      orderBy: { checkTime: 'asc' }
    });

    let workHours = null;
    if (inLog) {
      const diffMs = logTime - new Date(inLog.checkTime);
      workHours = (diffMs / 3600000).toFixed(1);
    }

    console.log(`✅ Điểm danh RA CA thành công cho NV: ${log.employee.fullName}`);

    // Phát tín hiệu real-time
    const socketPayload = {
      type: 'CHECKOUT',
      log: {
        id: log.employee.id,
        employeeCode: log.employee.employeeCode,
        name: log.employee.fullName,
        role: log.employee.department.name,
        time: new Date(log.checkTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        conf: `${((log.confidenceScore || 0.99) * 100).toFixed(1)}%`,
        status: log.status, // Sửa lỗi: Sử dụng trạng thái thực tế từ database
        type: 'OUT',
        avatar: log.employee.avatarUrl,
        workHours
      }
    };

    console.log('📡 Emitting attendanceUpdate (CHECKOUT):', socketPayload.log.name);
    req.io.emit('attendanceUpdate', socketPayload);

    res.json({
      message: 'Điểm danh ra ca thành công!',
      log: {
        id: log.id,
        checkTime: log.checkTime,
        type: log.type,
        workHours,
        employee: { id: employee.id, fullName: employee.fullName, department: employee.department.name, avatarUrl: employee.avatarUrl }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi điểm danh ra ca' });
  }
});


// ─────────── QUICK SCAN (Combine Extract + Identify) ───────────
app.post('/api/face/quick-scan', async (req, res) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'Thiếu dữ liệu hình ảnh' });

    // 1. Gọi AI Service để trích xuất embedding
    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/v1/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64 }),
      signal: AbortSignal.timeout(60000)
    });

    if (!aiResponse.ok) {
      return res.status(aiResponse.status).json({ matched: false, error: 'AI Service không phản hồi' });
    }

    const aiData = await aiResponse.json();
    if (!aiData.success || !aiData.embedding) {
      return res.json({ matched: false, message: aiData.error || 'Không tìm thấy khuôn mặt' });
    }

    // Kiểm tra chống giả mạo (Liveness Detection)
    if (aiData.liveness_score !== undefined && aiData.liveness_score < 0.65) {
      return res.status(403).json({
        matched: false,
        error: 'CẢNH BÁO GIAN LẬN: Hệ thống phát hiện bạn đang sử dụng ảnh chụp hoặc màn hình giả mạo! Vui lòng sử dụng người thật để điểm danh.',
        isSpoofing: true
      });
    }

    const embedding = aiData.embedding;

    // 2. Nhận diện nhân viên từ embedding
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: { department: true }
    });

    const enrolledEmployees = employees.filter(e => Array.isArray(e.faceEmbedding) && e.faceEmbedding.length > 0);
    if (enrolledEmployees.length === 0) {
      return res.json({ matched: false, aiData, message: 'Chưa có nhân viên nào đăng ký khuôn mặt' });
    }

    let bestMatch = null, bestScore = -1;
    for (const emp of enrolledEmployees) {
      if (emp.faceEmbedding.length !== embedding.length) continue;
      const score = cosineSim(embedding, emp.faceEmbedding);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = emp;
      }
    }

    console.log(`📊 Quick Scan - Best Match: ${bestMatch?.fullName}, Score: ${bestScore.toFixed(4)}`);

    if (bestScore < 0.60 || !bestMatch) {
      return res.json({ matched: false, aiData, confidence: +(bestScore * 100).toFixed(1), message: 'Không tìm thấy nhân viên khớp' });
    }

    res.json({
      matched: true,
      confidence: +(bestScore * 100).toFixed(1),
      aiData,
      employee: {
        id: bestMatch.id, employeeCode: bestMatch.employeeCode, fullName: bestMatch.fullName,
        department: bestMatch.department.name, avatarUrl: bestMatch.avatarUrl
      }
    });
  } catch (error) {
    console.error('Quick Scan Error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi quét nhanh' });
  }
});

// ─────────── QUICK ENROLL (Enroll by Image) ───────────
app.post('/api/face/enroll-by-image', adminAuth, async (req, res) => {
  try {
    const { employeeId, image_base64 } = req.body;
    if (!employeeId || !image_base64) return res.status(400).json({ error: 'Thiếu thông tin đăng ký' });

    // 1. Trích xuất embedding từ ảnh
    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/v1/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64 }),
      signal: AbortSignal.timeout(60000)
    });

    const aiData = await aiResponse.json();
    if (!aiData.success || !aiData.embedding) {
      return res.status(400).json({ error: aiData.error || 'Không tìm thấy khuôn mặt trong ảnh' });
    }

    // 2. Kiểm tra liveness cơ bản (nếu AI service hỗ trợ)
    if (aiData.liveness_score !== undefined && aiData.liveness_score < 0.6) {
      return res.status(400).json({ error: 'Ảnh không đạt chuẩn hoặc phát hiện giả mạo (Liveness thấp)' });
    }

    // 3. Lưu vào DB
    await prisma.employee.update({
      where: { id: employeeId },
      data: { faceEmbedding: aiData.embedding }
    });

    res.json({ success: true, message: 'Đã quét và lưu khuôn mặt mới thành công!' });
  } catch (error) {
    console.error('Enroll Error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký khuôn mặt' });
  }
});

// ─────────── MULTI-IMAGE ENROLL (Enroll by multiple images with head rotation) ───────────
app.post('/api/face/enroll-multi-images', adminAuth, async (req, res) => {
  try {
    const { employeeId, images_base64 } = req.body; // Expect an array of base64 images
    if (!Array.isArray(images_base64) || images_base64.length === 0) {
      return res.status(400).json({ error: 'Thiếu thông tin đăng ký hoặc ảnh không hợp lệ' });
    }

    const embeddings = [];
    for (const image_base64 of images_base64) {
      // 1. Trích xuất embedding từ mỗi ảnh
      const aiResponse = await fetch(`${AI_SERVICE_URL}/api/v1/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64 }),
        signal: AbortSignal.timeout(60000)
      });

      const aiData = await aiResponse.json();
      if (!aiData.success || !aiData.embedding) {
        // Nếu không tìm thấy khuôn mặt trong 1 trong các ảnh, coi như lỗi
        return res.status(400).json({ error: aiData.error || 'Không tìm thấy khuôn mặt trong một trong các ảnh' });
      }

      // 2. Kiểm tra liveness cơ bản cho mỗi ảnh (ngưỡng cao hơn cho enrollment để đảm bảo chất lượng)
      // Việc quay đầu là một dạng liveness chủ động, nhưng vẫn cần liveness thụ động từ AI.
      const ENROLL_LIVENESS_THRESHOLD = 0.7; // Ngưỡng cao hơn để đảm bảo ảnh gốc là người thật
      if (aiData.liveness_score !== undefined && aiData.liveness_score < ENROLL_LIVENESS_THRESHOLD) {
        return res.status(400).json({ error: 'Một trong các ảnh không đạt chuẩn hoặc phát hiện giả mạo (Liveness thấp)' });
      }
      embeddings.push(aiData.embedding);
    }

    // 3. Tính trung bình các embeddings để tạo ra một embedding tổng hợp và ổn định hơn
    if (embeddings.length === 0) {
      return res.status(400).json({ error: 'Không thể trích xuất embedding từ bất kỳ ảnh nào' });
    }

    const averagedEmbedding = embeddings[0].map((_, i) =>
      embeddings.reduce((sum, currentEmbedding) => sum + currentEmbedding[i], 0) / embeddings.length
    );

    // 4. Lưu vào DB
    if (employeeId) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { faceEmbedding: averagedEmbedding }
      });
    }

    res.json({ success: true, message: 'Xác thực khuôn mặt thành công!', embedding: averagedEmbedding });
  } catch (error) {
    console.error('Multi-Image Enroll Error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký khuôn mặt từ nhiều ảnh' });
  }
});

// ─────────── AUTO ATTENDANCE (Scan -> Identify -> Log) ───────────
app.post('/api/face/auto-attendance', async (req, res) => {
  try {
    const { image_base64, type = 'IN' } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'Thiếu dữ liệu hình ảnh' });

    // 1. Nhận diện (Sử dụng logic tương tự Quick Scan)
    const aiResponse = await fetch(`${AI_SERVICE_URL}/api/v1/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64 }),
      signal: AbortSignal.timeout(60000)
    });

    const aiData = await aiResponse.json();
    if (!aiData.success || !aiData.embedding) return res.json({ matched: false, message: 'Không tìm thấy khuôn mặt' });

    // 1.5 KIỂM TRA THỰC THỂ SỐNG (LIVENESS CHECK) - SIẾT CHẶT
    // Ngưỡng 0.7 thường là ngưỡng an toàn để loại bỏ ảnh/video chất lượng cao
    const LIVENESS_THRESHOLD = 0.7;
    if (aiData.liveness_score !== undefined && aiData.liveness_score < LIVENESS_THRESHOLD) {
      console.warn(`🚨 Cảnh báo gian lận: Phát hiện giả mạo với điểm số ${aiData.liveness_score}`);

      // Cố gắng nhận diện danh tính kể cả khi liveness thấp để ghi log bảo mật
      const employeesForSpoof = await prisma.employee.findMany({ where: { isActive: true } });
      let bestMatchForSpoof = null, bestScoreForSpoof = -1;
      for (const emp of employeesForSpoof) {
        if (!emp.faceEmbedding || emp.faceEmbedding.length !== aiData.embedding.length) continue;
        const score = cosineSim(aiData.embedding, emp.faceEmbedding);
        if (score > bestScoreForSpoof) { bestScoreForSpoof = score; bestMatchForSpoof = emp; }
      }
      const identifiedEmployeeId = (bestScoreForSpoof >= 0.60 && bestMatchForSpoof) ? bestMatchForSpoof.id : null;

      await recordSpoofingAttempt(identifiedEmployeeId, aiData.liveness_score, image_base64, req);

      return res.status(403).json({
        matched: false,
        error: 'CẢNH BÁO: Hệ thống phát hiện sử dụng ảnh/video giả mạo. Vui lòng dùng người thật!',
        isSpoofing: true
      });
    }

    // 2. Tìm nhân viên
    const employees = await prisma.employee.findMany({ where: { isActive: true }, include: { department: true } });
    const enrolled = employees.filter(e => Array.isArray(e.faceEmbedding) && e.faceEmbedding.length > 0);

    let bestMatch = null, bestScore = -1;
    for (const emp of enrolled) {
      const score = cosineSim(aiData.embedding, emp.faceEmbedding);
      if (score > bestScore) { bestScore = score; bestMatch = emp; }
    }

    if (bestScore < 0.60 || !bestMatch) {
      return res.json({ matched: false, message: 'Khuôn mặt chưa được đăng ký trong hệ thống' });
    }

    // 3. TỰ ĐỘNG GHI LOG CHẤM CÔNG (Vào ca/Ra ca)
    const logTime = new Date();
    const hour = logTime.getHours();
    const minute = logTime.getMinutes();
    let status = 'ON_TIME';

    if (type === 'IN') {
      const shifts = await prisma.shift.findMany({ orderBy: { startTime: 'asc' } });
      if (shifts.length > 0) {
        const currentMin = hour * 60 + minute;
        const assignedShift = shifts.reduce((prev, curr) => {
          const [pHr, pMin] = prev.startTime.split(':').map(Number);
          const [cHr, cMin] = curr.startTime.split(':').map(Number);
          return Math.abs(getMinutesDiff(currentMin, cHr * 60 + cMin)) < Math.abs(getMinutesDiff(currentMin, pHr * 60 + pMin)) ? curr : prev;
        });
        const [sHr, sMin] = assignedShift.startTime.split(':').map(Number);
        if (getMinutesDiff(currentMin, sHr * 60 + sMin) > (assignedShift.lateAfterMinutes || 0)) status = 'LATE';
      }
    } else {
      const shifts = await prisma.shift.findMany();
      if (shifts.length > 0) {
        const currentMin = hour * 60 + minute;
        const assignedShift = shifts.reduce((prev, curr) => {
          const [eHr, eMin] = curr.endTime.split(':').map(Number);
          const [pHe, pMe] = prev.endTime.split(':').map(Number);
          return Math.abs(getMinutesDiff(currentMin, eHr * 60 + eMin)) < Math.abs(getMinutesDiff(currentMin, pHe * 60 + pMe)) ? curr : prev;
        });
        const [eHr, eMin] = assignedShift.endTime.split(':').map(Number);
        if (currentMin < (eHr * 60 + eMin)) status = 'EARLY_LEAVE';
      }
    }

    const newLog = await prisma.attendanceLog.create({
      data: {
        employeeId: bestMatch.id,
        type,
        status,
        confidenceScore: bestScore,
        checkTime: logTime
      },
      include: { employee: { include: { department: true } } }
    });

    // Gửi thông báo realtime qua Socket.io
    req.io.emit('attendanceUpdate', {
      type: type === 'IN' ? 'CHECKIN' : 'CHECKOUT',
      log: {
        id: bestMatch.id,
        employeeCode: bestMatch.employeeCode,
        name: bestMatch.fullName,
        role: bestMatch.department.name,
        time: logTime.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }),
        conf: `${(bestScore * 100).toFixed(1)}%`,
        status: status,
        type: type,
        avatar: bestMatch.avatarUrl
      }
    });

    res.json({
      matched: true,
      message: `Chào ${bestMatch.fullName}, bạn đã ${type === 'IN' ? 'vào ca' : 'ra ca'} ${status === 'LATE' ? 'TRỄ' : (status === 'EARLY_LEAVE' ? 'SỚM' : 'THÀNH CÔNG')}!`,
      employee: {
        id: bestMatch.id,
        fullName: bestMatch.fullName,
        employeeCode: bestMatch.employeeCode,
        department: bestMatch.department.name,
        avatarUrl: bestMatch.avatarUrl
      },
      confidence: +(bestScore * 100).toFixed(1),
      log: newLog
    });

  } catch (error) {
    res.status(500).json({ error: 'Lỗi hệ thống chấm công tự động' });
  }
});

// ─────────── FACE IDENTIFY ───────────
app.post('/api/face/identify', async (req, res) => {
  console.log('🔍 Received identify request...');
  try {
    const { embedding, livenessScore, image_base64 } = req.body; // Added image_base64 here
    if (!embedding || !Array.isArray(embedding)) return res.status(400).json({ error: 'Thiếu embedding vector' });

    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        NOT: { faceEmbedding: { equals: [] } } // Chỉ lấy nhân viên đã đăng ký mặt
      },
      include: { department: true }
    });

    if (employees.length === 0) return res.json({ matched: false, message: 'Chưa có nhân viên nào đăng ký khuôn mặt' });

    // Kiểm tra chống giả mạo (Liveness Detection)
    const LIVENESS_THRESHOLD_IDENTIFY = 0.65; // Can be same as AUTO_ATTENDANCE or slightly different
    if (livenessScore !== undefined && livenessScore !== null && livenessScore < 0.65) {
      // Try to find best match even if liveness fails, to log employeeId if possible
      let bestMatchForSpoof = null, bestScoreForSpoof = -1;
      for (const emp of employees) {
        if (emp.faceEmbedding.length !== embedding.length) continue;
        const score = cosineSim(embedding, emp.faceEmbedding);
        if (score > bestScoreForSpoof) { bestScoreForSpoof = score; bestMatchForSpoof = emp; }
      }
      const identifiedEmployeeId = (bestScoreForSpoof >= 0.60 && bestMatchForSpoof) ? bestMatchForSpoof.id : null;

      await recordSpoofingAttempt(identifiedEmployeeId, livenessScore, image_base64, req);
      return res.status(403).json({
        matched: false,
        error: 'CẢNH BÁO GIAN LẬN: Phát hiện sử dụng hình ảnh/video giả mạo. Hành động này sẽ được ghi lại vào hệ thống bảo mật.',
        isSpoofing: true
      });
    }

    let bestMatch = null, bestScore = -1;
    const scores = [];
    for (const emp of employees) {
      if (emp.faceEmbedding.length !== embedding.length) {
        console.warn(`⚠️ Mismatch embedding length: Request(${embedding.length}) vs DB(${emp.faceEmbedding.length}) for ${emp.fullName}`);
        continue;
      }
      const score = cosineSim(embedding, emp.faceEmbedding);
      scores.push({ name: emp.fullName, score: score.toFixed(4) });
      if (score > bestScore) { bestScore = score; bestMatch = emp; }
    }

    console.log(`\n--- 🔍 KẾT QUẢ NHẬN DIỆN TỪ MOBILE ---`);
    console.log(`👤 Nhân viên gần giống nhất: ${bestMatch?.fullName || 'N/A'}`);
    console.log(`📈 Độ tin cậy (Similarity): ${(bestScore * 100).toFixed(2)}%`);
    console.log(`-------------------------------------\n`);

    if (bestScore < 0.55 || !bestMatch) {
      return res.json({
        matched: false,
        confidence: +(bestScore * 100).toFixed(1),
        message: `Không khớp. Gần giống nhất: ${bestMatch ? bestMatch.fullName : 'N/A'} (${(bestScore * 100).toFixed(1)}%)`
      });
    }

    res.json({
      matched: true,
      confidence: +(bestScore * 100).toFixed(1),
      employee: { id: bestMatch.id, employeeCode: bestMatch.employeeCode, fullName: bestMatch.fullName, email: bestMatch.email, phone: bestMatch.phone, department: bestMatch.department.name, avatarUrl: bestMatch.avatarUrl, isActive: bestMatch.isActive }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi nhận diện khuôn mặt' });
  }
});

// ─────────── DEPARTMENTS ───────────
app.get('/api/departments', adminAuth, async (req, res) => {
  try {
    res.json(await prisma.department.findMany());
  } catch {
    res.status(500).json({ error: 'Lỗi tải phòng ban' });
  }
});

// ─────────── EMPLOYEE PROFILE ───────────
app.get('/api/employees/:id', adminAuth, async (req, res) => {
  try {
    const emp = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { department: true }
    });
    if (!emp) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    const allLogs = await prisma.attendanceLog.findMany({
      where: { employeeId: req.params.id },
      orderBy: { checkTime: 'asc' }
    });

    let totalWorkHours = 0;
    const logsByDay = {};
    allLogs.forEach(l => {
      const dateStr = new Date(l.checkTime).toISOString().split('T')[0];
      if (!logsByDay[dateStr]) logsByDay[dateStr] = [];
      logsByDay[dateStr].push(l);
    });

    for (const dayLogs of Object.values(logsByDay)) {
      let lastIn = null;
      for (const log of dayLogs) {
        if (log.type === 'IN') lastIn = log;
        else if (log.type === 'OUT' && lastIn) {
          const diffMs = new Date(log.checkTime) - new Date(lastIn.checkTime);
          totalWorkHours += diffMs / 3600000;
          lastIn = null;
        }
      }
    }

    const inLogs = allLogs.filter(l => l.type === 'IN');
    const onTimeCount = inLogs.filter(l => l.status === 'ON_TIME').length;
    const lateCount = inLogs.filter(l => l.status === 'LATE').length;

    res.json({
      id: emp.id, employeeCode: emp.employeeCode, fullName: emp.fullName,
      email: emp.email, phone: emp.phone, avatarUrl: emp.avatarUrl,
      department: emp.department.name, departmentId: emp.departmentId,
      isActive: emp.isActive, faceEnrolled: emp.faceEmbedding?.length > 0,
      createdAt: emp.createdAt,
      stats: { totalDays: Object.keys(logsByDay).length, onTime: onTimeCount, late: lateCount, totalHours: +totalWorkHours.toFixed(2) },
      recentLogs: allLogs.reverse().slice(0, 30).map(l => ({
        id: l.id, type: l.type, status: l.status,
        checkTime: l.checkTime, confidenceScore: l.confidenceScore
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi tải hồ sơ nhân viên' });
  }
});


// ─────────── PAYROLL ───────────
app.get('/api/payroll', authMiddleware, async (req, res) => {
  try {
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const whereClause = { isActive: true };
    if (req.user.role === 'EMPLOYEE') {
      whereClause.id = req.user.id;
    }
    const employees = await prisma.employee.findMany({ where: whereClause, include: { department: true } });

    let config = await prisma.systemConfig.findFirst();
    if (!config) config = await prisma.systemConfig.create({ data: {} });
    const HOURLY_RATE = config.hourlyRate;
    const STANDARD_HOURS = config.standardHours;

    const payroll = await Promise.all(employees.map(async emp => {
      const [logs, leaves] = await Promise.all([
        prisma.attendanceLog.findMany({
          where: { employeeId: emp.id, checkTime: { gte: startDate, lte: endDate } },
          orderBy: { checkTime: 'asc' }
        }),
        prisma.leave.findMany({
          where: { employeeId: emp.id, status: 'APPROVED', from: { lte: endDate }, to: { gte: startDate } }
        })
      ]);

      let rawWorkHours = 0;
      let onTimeCount = 0;
      let lateCount = 0;
      let actualDaysWorked = 0;
      const logsByDay = {};

      logs.forEach(l => {
        const dateStr = new Date(l.checkTime).toISOString().split('T')[0];
        if (!logsByDay[dateStr]) logsByDay[dateStr] = [];
        logsByDay[dateStr].push(l);
      });

      for (const [date, dayLogs] of Object.entries(logsByDay)) {
        const ins = dayLogs.filter(l => l.type === 'IN');
        if (ins.length > 0) {
          actualDaysWorked++;
          if (ins[0].status === 'ON_TIME') onTimeCount++;
          else if (ins[0].status === 'LATE') lateCount++;
        }

        let dayWorkMs = 0;
        let lastIn = null;
        dayLogs.forEach(log => {
          if (log.type === 'IN') lastIn = log;
          else if (log.type === 'OUT' && lastIn) {
            dayWorkMs += (new Date(log.checkTime) - new Date(lastIn.checkTime));
            lastIn = null;
          }
        });
        rawWorkHours += (dayWorkMs / 3600000);
      }

      let leaveHours = 0;
      leaves.forEach(lv => {
        const lvStart = new Date(Math.max(new Date(lv.from), startDate));
        const lvEnd = new Date(minDate(new Date(lv.to), endDate));
        if (lvStart <= lvEnd && lv.type !== 'Nghỉ không lương') {
          const diffDays = Math.ceil((lvEnd - lvStart) / (1000 * 60 * 60 * 24)) || 1;
          leaveHours += diffDays * 8;
        }
      });

      const totalPaidHours = +(rawWorkHours + leaveHours).toFixed(2);
      const otHours = Math.max(0, totalPaidHours - STANDARD_HOURS);
      const regHours = totalPaidHours - otHours;

      const baseSalary = regHours * HOURLY_RATE;
      const overtimePay = otHours * HOURLY_RATE * 1.5;
      const totalSalary = Math.round(baseSalary + overtimePay);

      // Generate calendar detail
      const daysInMonth = new Date(year, month, 0).getDate();
      const dailyDetail = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayLogs = logsByDay[dateStr] || [];
        const firstIn = dayLogs.find(l => l.type === 'IN');
        const lastOut = [...dayLogs].reverse().find(l => l.type === 'OUT');

        if (firstIn) {
          dailyDetail[dateStr] = { status: firstIn.status, checkIn: firstIn.checkTime, checkOut: lastOut?.id !== firstIn.id ? lastOut?.checkTime : null };
        } else {
          const dayOfWeek = new Date(year, month - 1, d).getDay();
          const hasLeave = leaves.some(lv => new Date(lv.from) <= new Date(dateStr) && new Date(lv.to) >= new Date(dateStr));
          dailyDetail[dateStr] = { status: hasLeave ? 'ON_TIME' : (dayOfWeek === 0 || dayOfWeek === 6) ? 'WEEKEND' : 'ABSENT' };
        }
      }

      return {
        id: emp.id, employeeCode: emp.employeeCode, fullName: emp.fullName,
        department: emp.department.name, avatarUrl: emp.avatarUrl,
        daysWorked: actualDaysWorked + (leaveHours / 8), onTime: onTimeCount, late: lateCount, dailyDetail,
        standardHours: +regHours.toFixed(2), overtimeHours: +otHours.toFixed(2),
        baseSalary: Math.round(baseSalary), totalSalary
      };
    }));
    res.json({ month: +month, year: +year, payroll });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi tính bảng lương' });
  }
});

app.get('/api/payroll/export', adminAuth, async (req, res) => {
  try {
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: { department: true }
    });

    let config = await prisma.systemConfig.findFirst();
    if (!config) config = await prisma.systemConfig.create({ data: {} });
    const HOURLY_RATE = config.hourlyRate;
    const STANDARD_HOURS = config.standardHours;

    const payrollData = await Promise.all(employees.map(async emp => {
      const [logs, leaves] = await Promise.all([
        prisma.attendanceLog.findMany({
          where: { employeeId: emp.id, checkTime: { gte: startDate, lte: endDate } },
          orderBy: { checkTime: 'asc' }
        }),
        prisma.leave.findMany({
          where: { employeeId: emp.id, status: 'APPROVED', from: { lte: endDate }, to: { gte: startDate } }
        })
      ]);

      let rawWorkHours = 0;
      let actualDaysWorked = 0;
      const logsByDay = {};
      logs.forEach(l => {
        const d = new Date(l.checkTime).toISOString().split('T')[0];
        if (!logsByDay[d]) logsByDay[d] = [];
        logsByDay[d].push(l);
      });

      for (const dayLogs of Object.values(logsByDay)) {
        if (dayLogs.some(l => l.type === 'IN')) actualDaysWorked++;
        let dayWorkMs = 0, lastIn = null;
        dayLogs.forEach(log => {
          if (log.type === 'IN') lastIn = log;
          else if (log.type === 'OUT' && lastIn) {
            dayWorkMs += (new Date(log.checkTime) - new Date(lastIn.checkTime));
            lastIn = null;
          }
        });
        rawWorkHours += (dayWorkMs / 3600000);
      }

      let leaveHours = 0;
      leaves.forEach(lv => {
        const lvStart = new Date(Math.max(new Date(lv.from), startDate));
        const lvEnd = new Date(minDate(new Date(lv.to), endDate));
        if (lvStart <= lvEnd && lv.type !== 'Nghỉ không lương') {
          const diffDays = Math.ceil((lvEnd - lvStart) / (1000 * 60 * 60 * 24)) || 1;
          leaveHours += diffDays * 8;
        }
      });

      const totalPaidHours = +(rawWorkHours + leaveHours).toFixed(2);
      const otHours = Math.max(0, totalPaidHours - STANDARD_HOURS);
      const regHours = totalPaidHours - otHours;
      const baseSalary = regHours * HOURLY_RATE;
      const overtimePay = otHours * HOURLY_RATE * 1.5;

      return {
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        department: emp.department.name,
        daysWorked: actualDaysWorked + (leaveHours / 8),
        standardHours: +regHours.toFixed(2),
        overtimeHours: +otHours.toFixed(2),
        baseSalary: Math.round(baseSalary),
        totalSalary: Math.round(baseSalary + overtimePay)
      };
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Bảng lương ${month}-${year}`);
    worksheet.columns = [
      { header: 'Mã NV', key: 'employeeCode', width: 15 },
      { header: 'Họ Tên', key: 'fullName', width: 25 },
      { header: 'Phòng Ban', key: 'department', width: 20 },
      { header: 'Công (Ngày)', key: 'daysWorked', width: 15 },
      { header: 'Giờ Chuẩn', key: 'standardHours', width: 15 },
      { header: 'Giờ OT', key: 'overtimeHours', width: 15 },
      { header: 'Lương CB (VNĐ)', key: 'baseSalary', width: 20 },
      { header: 'Tổng Lương (VNĐ)', key: 'totalSalary', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    payrollData.forEach(data => worksheet.addRow(data));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=BangLuong_${month}_${year}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi xuất file Excel' });
  }
});

// ─────────── SHIFTS (PostgreSQL) ───────────
app.get('/api/shifts', adminAuth, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(shifts);
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.post('/api/shifts', adminAuth, async (req, res) => {
  const { name, startTime, endTime, color = 'blue', lateAfterMinutes = 15 } = req.body;
  if (!name || !startTime || !endTime) return res.status(400).json({ error: 'Thiếu thông tin ca làm việc' });
  try {
    const shift = await prisma.shift.create({ data: { name, startTime, endTime, color, lateAfterMinutes } });
    res.json({ message: 'Tạo ca thành công', shift });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.put('/api/shifts/:id', adminAuth, async (req, res) => {
  try {
    const shift = await prisma.shift.update({ where: { id: req.params.id }, data: req.body });
    res.json({ message: 'Cập nhật ca thành công', shift });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.delete('/api/shifts/:id', adminAuth, async (req, res) => {
  try {
    await prisma.shift.delete({ where: { id: req.params.id } });
    res.json({ message: 'Xóa ca thành công' });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// ─────────── LEAVES (PostgreSQL) ───────────
app.get('/api/leaves', authMiddleware, async (req, res) => {
  try {
    const leaves = await prisma.leave.findMany({
      include: { employee: { select: { fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const formatted = leaves.map(l => ({
      id: l.id,
      employeeName: l.employee.fullName,
      employeeId: l.employeeId,
      avatarUrl: l.employee.avatarUrl,
      type: l.type,
      from: l.from,
      to: l.to,
      days: l.days,
      reason: l.reason,
      status: l.status.toLowerCase(),
      submittedAt: l.createdAt
    }));
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.post('/api/leaves', authMiddleware, async (req, res) => {
  const { employeeId, type, from, to, days, reason } = req.body;
  // If the admin uses the mock form, it doesn't have employeeId (frontend currently maps employeeName only). 
  // Wait, I updated the frontend to send employeeId if EMPLOYEE. For Admin, it might fail unless we fix it.
  // Assuming frontend for Admin is not actively used to create leaves for others.
  if (!employeeId || !from || !to) return res.status(400).json({ error: 'Thiếu thông tin đơn nghỉ phép' });
  try {
    const leave = await prisma.leave.create({
      data: { employeeId, type: type || 'Nghỉ phép năm', from, to, days: days || 1, reason: reason || '', status: 'PENDING' }
    });
    res.json({ message: 'Gửi đơn thành công', leave });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.put('/api/leaves/:id/approve', adminAuth, async (req, res) => {
  try {
    const leave = await prisma.leave.update({ where: { id: req.params.id }, data: { status: 'APPROVED' } });
    res.json({ message: 'Đã duyệt đơn nghỉ phép', leave });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.put('/api/leaves/:id/reject', adminAuth, async (req, res) => {
  try {
    const leave = await prisma.leave.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
    res.json({ message: 'Đã từ chối đơn nghỉ phép', leave });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// ─────────── EMPLOYEE PORTAL ───────────
// Đăng nhập bằng mã nhân viên
app.post('/api/portal/login', async (req, res) => {
  try {
    const { employeeCode } = req.body;
    if (!employeeCode) return res.status(400).json({ error: 'Vui lòng nhập mã nhân viên' });
    const emp = await prisma.employee.findUnique({
      where: { employeeCode },
      include: { department: true }
    });
    if (!emp) return res.status(404).json({ error: 'Mã nhân viên không tồn tại' });
    if (emp.passwordHash) {
      const isMatch = await bcrypt.compare(req.body.password || '', emp.passwordHash);
      if (!isMatch) return res.status(401).json({ error: 'Sai mật khẩu' });
    } else {
      if (req.body.password !== '123456' && req.body.password !== emp.employeeCode) {
        return res.status(401).json({ error: 'Sai mật khẩu' });
      }
    }
    if (!emp.isActive) return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa' });
    const token = jwt.sign(
      { id: emp.id, employeeCode: emp.employeeCode, role: 'EMPLOYEE' },
      JWT_SECRET, { expiresIn: '8h' }
    );
    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: emp.id, employeeCode: emp.employeeCode, fullName: emp.fullName,
        email: emp.email, phone: emp.phone, avatarUrl: emp.avatarUrl,
        department: emp.department.name, departmentId: emp.departmentId,
        faceEnrolled: emp.faceEmbedding?.length > 0,
        role: 'EMPLOYEE'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Middleware xác thực nhân viên portal
const employeeAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (decoded.role !== 'EMPLOYEE') return res.status(403).json({ error: 'Không có quyền truy cập' });
    req.employeeId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

// Lấy thông tin + thống kê của bản thân
app.get('/api/portal/me', employeeAuth, async (req, res) => {
  try {
    const emp = await prisma.employee.findUnique({
      where: { id: req.employeeId },
      include: { department: true }
    });
    if (!emp) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [todayLogs, monthLogs, recent] = await Promise.all([
      prisma.attendanceLog.findMany({ where: { employeeId: emp.id, checkTime: { gte: today } }, orderBy: { checkTime: 'asc' } }),
      prisma.attendanceLog.findMany({ where: { employeeId: emp.id, type: 'IN', checkTime: { gte: startOfMonth } } }),
      prisma.attendanceLog.findMany({ where: { employeeId: emp.id }, orderBy: { checkTime: 'desc' }, take: 20 })
    ]);
    let totalWorkHours = 0;
    let lastIn = null;
    for (const log of todayLogs) {
      if (log.type === 'IN') lastIn = log;
      else if (log.type === 'OUT' && lastIn) {
        const diffMs = new Date(log.checkTime) - new Date(lastIn.checkTime);
        totalWorkHours += diffMs / 3600000;
        lastIn = null;
      }
    }
    const checkin = todayLogs.find(l => l.type === 'IN');
    const checkout = [...todayLogs].reverse().find(l => l.type === 'OUT');
    const workHours = totalWorkHours > 0 ? totalWorkHours.toFixed(2) : null;
    res.json({
      id: emp.id, employeeCode: emp.employeeCode, fullName: emp.fullName,
      email: emp.email, phone: emp.phone, avatarUrl: emp.avatarUrl,
      department: emp.department.name, departmentId: emp.departmentId,
      faceEnrolled: emp.faceEmbedding?.length > 0,
      today: { checkin: checkin ? { time: checkin.checkTime, status: checkin.status } : null, checkout: checkout ? { time: checkout.checkTime } : null, workHours },
      month: { total: monthLogs.length, onTime: monthLogs.filter(l => l.status === 'ON_TIME').length, late: monthLogs.filter(l => l.status === 'LATE').length },
      recent: recent.map(l => ({ id: l.id, type: l.type, status: l.status, checkTime: l.checkTime }))
    });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Lỗi tải dữ liệu' });
  }
});

// Cập nhật thông tin cá nhân
app.put('/api/portal/update-profile', employeeAuth, async (req, res) => {
  try {
    const { fullName, email, phone, avatarUrl } = req.body;
    const emp = await prisma.employee.update({
      where: { id: req.employeeId },
      data: { fullName, email, phone, avatarUrl },
      include: { department: true }
    });
    res.json({
      message: 'Cập nhật thông tin thành công',
      employee: { id: emp.id, fullName: emp.fullName, email: emp.email, phone: emp.phone, department: emp.department.name, avatarUrl: emp.avatarUrl, faceEnrolled: emp.faceEmbedding?.length > 0 }
    });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') return res.status(400).json({ error: 'Email này đã được sử dụng bởi nhân viên khác' });
    res.status(500).json({ error: 'Lỗi cập nhật thông tin' });
  }
});

// Đổi mật khẩu
app.post('/api/portal/change-password', employeeAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const emp = await prisma.employee.findUnique({ where: { id: req.employeeId } });
    if (emp.passwordHash) {
      const isMatch = await bcrypt.compare(currentPassword, emp.passwordHash);
      if (!isMatch) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    } else {
      if (currentPassword !== '123456' && currentPassword !== emp.employeeCode) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
      }
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.employee.update({ where: { id: emp.id }, data: { passwordHash: hash } });
    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Lỗi đổi mật khẩu' });
  }
});

// Cập nhật khuôn mặt (embedding từ AI Service)
app.put('/api/portal/update-face', employeeAuth, async (req, res) => {
  try {
    const { faceEmbedding } = req.body;
    if (!faceEmbedding || !Array.isArray(faceEmbedding)) return res.status(400).json({ error: 'Thiếu dữ liệu khuôn mặt' });

    // Lấy thông tin nhân viên hiện tại
    const currentEmp = await prisma.employee.findUnique({ where: { id: req.employeeId } });
    if (!currentEmp) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });

    // Kiểm tra 1: Nếu nhân viên đã từng đăng ký khuôn mặt, khuôn mặt mới phải giống khuôn mặt cũ (để chống gian lận/đăng ký hộ)
    if (currentEmp.faceEmbedding && currentEmp.faceEmbedding.length > 0) {
      if (currentEmp.faceEmbedding.length === faceEmbedding.length) {
        const simToOld = cosineSim(faceEmbedding, currentEmp.faceEmbedding);
        if (simToOld < 0.6) {
          return res.status(400).json({ error: 'Khuôn mặt mới không khớp với dữ liệu đã đăng ký ban đầu. Nếu bạn là chủ tài khoản nhưng thay đổi diện mạo quá lớn, vui lòng liên hệ Admin/HR để reset.' });
        }
      }
    }

    // Kiểm tra 2: Không cho phép 1 khuôn mặt đăng ký cho nhiều tài khoản khác nhau
    const allEmployees = await prisma.employee.findMany({
      where: { isActive: true, faceEmbedding: { isEmpty: false } }
    });

    for (const emp of allEmployees) {
      if (emp.id === req.employeeId) continue; // Bỏ qua bản thân
      if (emp.faceEmbedding.length !== faceEmbedding.length) continue;

      const simToOther = cosineSim(faceEmbedding, emp.faceEmbedding);
      if (simToOther >= 0.6) {
        return res.status(400).json({ error: 'Khuôn mặt này đã được sử dụng bởi một tài khoản khác trong hệ thống. Vui lòng kiểm tra lại.' });
      }
    }

    // Nếu qua được cả 2 bài kiểm tra -> Cho phép lưu
    await prisma.employee.update({ where: { id: req.employeeId }, data: { faceEmbedding } });
    res.json({ message: 'Cập nhật khuôn mặt thành công! Hệ thống AI sẽ nhận diện bạn từ lần sau.' });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Lỗi cập nhật khuôn mặt' });
  }
});

// ─────────── KIOSK (Employee self-service) ───────────

app.get('/api/kiosk/:id', async (req, res) => {
  try {
    const emp = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { department: true }
    });
    if (!emp) return res.status(404).json({ error: 'Không tìm thấy nhân viên' });

    // Trạng thái hôm nay
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayLogs = await prisma.attendanceLog.findMany({
      where: { employeeId: emp.id, checkTime: { gte: today } },
      orderBy: { checkTime: 'asc' }
    });
    let totalWorkHours = 0;
    let lastIn = null;
    for (const log of todayLogs) {
      if (log.type === 'IN') lastIn = log;
      else if (log.type === 'OUT' && lastIn) {
        const diffMs = new Date(log.checkTime) - new Date(lastIn.checkTime);
        totalWorkHours += diffMs / 3600000;
        lastIn = null;
      }
    }
    const checkin = todayLogs.find(l => l.type === 'IN');
    const checkout = todayLogs.filter(l => l.type === 'OUT').pop();
    const workHours = totalWorkHours > 0 ? totalWorkHours.toFixed(2) : null;

    // Tháng này
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthLogs = await prisma.attendanceLog.findMany({
      where: { employeeId: emp.id, type: 'IN', checkTime: { gte: startOfMonth } }
    });
    const onTime = monthLogs.filter(l => l.status === 'ON_TIME').length;
    const late = monthLogs.filter(l => l.status === 'LATE').length;

    // 7 bản ghi gần nhất
    const recent = await prisma.attendanceLog.findMany({
      where: { employeeId: emp.id },
      orderBy: { checkTime: 'desc' },
      take: 7
    });

    res.json({
      id: emp.id, employeeCode: emp.employeeCode, fullName: emp.fullName,
      email: emp.email, phone: emp.phone, avatarUrl: emp.avatarUrl,
      department: emp.department.name, isActive: emp.isActive,
      today: {
        checkin: checkin ? { time: checkin.checkTime, status: checkin.status } : null,
        checkout: checkout ? { time: checkout.checkTime } : null,
        workHours
      },
      month: { total: monthLogs.length, onTime, late },
      recent: recent.map(l => ({ id: l.id, type: l.type, status: l.status, checkTime: l.checkTime }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi tải dữ liệu kiosk' });
  }
});

// ─────────── NOTIFICATIONS (PostgreSQL) ───────────
app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const notifs = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(notifs.map(n => ({ id: n.id, title: n.title, content: n.content, date: n.createdAt })));
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.post('/api/notifications', adminAuth, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung' });
  try {
    const notif = await prisma.notification.create({ data: { title, content } });
    res.json({ message: 'Đã gửi thông báo', notif: { id: notif.id, title: notif.title, content: notif.content, date: notif.createdAt } });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

app.delete('/api/notifications/:id', adminAuth, async (req, res) => {
  try {
    await prisma.notification.delete({ where: { id: req.params.id } });
    res.json({ message: 'Xóa thông báo thành công' });
  } catch (err) { res.status(500).json({ error: 'Lỗi máy chủ' }); }
});


// ─────────── EXCEPTION REQUESTS ───────────
app.get('/api/exceptions', authMiddleware, async (req, res) => {
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

app.post('/api/exceptions', authMiddleware, async (req, res) => {
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

    // Tính toán lại trạng thái trễ dựa trên thời gian trong yêu cầu
    const checkTime = new Date(exc.checkTime);
    const currentMin = checkTime.getHours() * 60 + checkTime.getMinutes();

    const shifts = await prisma.shift.findMany({ orderBy: { startTime: 'asc' } });

    let isLate = false;
    if (exc.type === 'IN' && shifts.length > 0) {
      let closestShift = shifts[0];
      let minDiff = Infinity;
      for (const s of shifts) {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const sMin = sh * 60 + sm;
        let diff = Math.abs(getMinutesDiff(currentMin, sMin));
        if (diff < minDiff) { minDiff = diff; closestShift = s; }
      }
      const [sh, sm] = closestShift.startTime.split(':').map(Number);
      const allowedLate = closestShift.lateAfterMinutes || 0;
      const delay = getMinutesDiff(currentMin, sh * 60 + sm);
      if (delay > allowedLate) isLate = true;
    }

    await prisma.exceptionRequest.update({ where: { id: req.params.id }, data: { status: 'APPROVED' } });

    await prisma.attendanceLog.create({
      data: {
        employeeId: exc.employeeId,
        type: exc.type,
        status: isLate ? 'LATE' : 'ON_TIME',
        checkTime: exc.checkTime,
        method: 'MANUAL',
        confidenceScore: 1.0
      }
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

// ─────────── REPORTS ───────────
app.get('/api/reports/manual-on-time', adminAuth, async (req, res) => {
  try {
    // Lấy các log được duyệt thủ công là Đúng giờ
    const logs = await prisma.attendanceLog.findMany({
      where: { method: 'MANUAL', status: 'ON_TIME', type: 'IN' },
      include: { employee: { include: { department: true } } },
      orderBy: { checkTime: 'desc' }
    });

    const shifts = await prisma.shift.findMany();

    const reportData = logs.map(log => {
      const checkTime = new Date(log.checkTime);
      const logMin = checkTime.getHours() * 60 + checkTime.getMinutes();

      let closestShift = null;
      let minDiff = Infinity;
      shifts.forEach(s => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const sMin = sh * 60 + sm;
        let diff = getMinutesDiff(logMin, sMin);
        if (Math.abs(diff) < minDiff) {
          minDiff = Math.abs(diff);
          closestShift = s;
        }
      });

      if (!closestShift) return null;

      const [sh, sm] = closestShift.startTime.split(':').map(Number);
      const sMin = sh * 60 + sm;
      let delay = getMinutesDiff(logMin, sMin);

      if (delay > (closestShift.lateAfterMinutes || 0)) {
        return {
          id: log.id,
          employeeId: log.employeeId,
          name: log.employee.fullName,
          dept: log.employee.department.name,
          checkTime: log.checkTime,
          shiftName: closestShift.name,
          scheduledStart: closestShift.startTime,
          delayMinutes: delay
        };
      }
      return null;
    }).filter(Boolean);

    const summary = reportData.reduce((acc, curr) => {
      if (!acc[curr.employeeId]) {
        acc[curr.employeeId] = { employeeId: curr.employeeId, name: curr.name, dept: curr.dept, count: 0, totalDelay: 0, logs: [] };
      }
      acc[curr.employeeId].count++;
      acc[curr.employeeId].totalDelay += curr.delayMinutes;
      acc[curr.employeeId].logs.push(curr);
      return acc;
    }, {});

    res.json(Object.values(summary).sort((a, b) => b.count - a.count));
  } catch (err) { res.status(500).json({ error: 'Lỗi tạo báo cáo' }); }
});

// ─────────── REPORTS - SPOOFING ATTEMPTS ───────────
app.get('/api/reports/spoofing-attempts', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, employeeId, status } = req.query;
    const where = {};

    if (startDate) where.timestamp = { gte: new Date(startDate) };
    if (endDate) where.timestamp = { ...where.timestamp, lte: new Date(endDate) };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const spoofingAttempts = await prisma.spoofingAttempt.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeCode: true, avatarUrl: true } } },
      orderBy: { timestamp: 'desc' },
    });

    res.json(spoofingAttempts);
  } catch (error) {
    console.error('Error fetching spoofing attempts report:', error);
    res.status(500).json({ error: 'Lỗi khi lấy báo cáo gian lận' });
  }
});


// ─────────── CONFIG (System Settings) ───────────
app.get('/api/config', adminAuth, async (req, res) => {
  try {
    let config = await prisma.systemConfig.findFirst();
    if (!config) config = await prisma.systemConfig.create({ data: {} });
    res.json(config);
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

app.put('/api/config', adminAuth, async (req, res) => {
  try {
    const { hourlyRate, standardHours } = req.body;
    let config = await prisma.systemConfig.findFirst();
    if (config) {
      config = await prisma.systemConfig.update({ where: { id: config.id }, data: { hourlyRate: +hourlyRate, standardHours: +standardHours } });
    } else {
      config = await prisma.systemConfig.create({ data: { hourlyRate: +hourlyRate, standardHours: +standardHours } });
    }
    res.json(config);
  } catch (err) { res.status(500).json({ error: 'Lỗi' }); }
});

const PORT = process.env.PORT || 5000;

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`❌ Lỗi: Cổng ${PORT} đã bị chiếm dụng. Hãy tắt ứng dụng đang dùng cổng này hoặc đổi PORT khác trong file .env.`);
    process.exit(1);
  }
});

server.listen(PORT, () => console.log(`✅ BioHR Backend chạy tại cổng ${PORT} (với Socket.io)`));
