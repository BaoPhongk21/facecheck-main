import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

const db = SQLite.openDatabaseSync('attendance.db');

export const initDB = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS offline_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imageBase64 TEXT,
      type TEXT,
      timestamp TEXT
    );
  `);
};

export const saveLogOffline = (imageBase64, type) => {
  const timestamp = new Date().toISOString();
  db.runSync(
    'INSERT INTO offline_logs (imageBase64, type, timestamp) VALUES (?, ?, ?)',
    [imageBase64, type, timestamp]
  );
  console.log('📦 Log saved offline with image');
};

export const syncLogs = async (backendUrl) => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const logs = db.getAllSync('SELECT * FROM offline_logs');
  if (logs.length === 0) return;

  console.log(`🔄 Syncing ${logs.length} offline logs...`);

  for (const log of logs) {
    try {
      // Vì offline không biết ID, nên dùng quick-scan để vừa nhận diện vừa điểm danh
      const res = await axios.post(`${backendUrl}/api/face/quick-scan`, {
        image_base64: log.imageBase64
      });

      if (res.data.matched) {
        const employeeId = res.data.employee.id;
        const endpoint = log.type === 'IN' ? '/api/attendance/checkin' : '/api/attendance/checkout';
        
        await axios.post(`${backendUrl}${endpoint}`, {
          employeeId,
          confidenceScore: res.data.confidence / 100,
          type: log.type,
          checkTime: log.timestamp // Quan trọng: Giữ nguyên thời gian lúc điểm danh offline
        });
        
        console.log(`✅ Synced log for ${res.data.employee.fullName}`);
        db.runSync('DELETE FROM offline_logs WHERE id = ?', [log.id]);
      } else {
        console.log(`⚠️ Could not match face for offline log ${log.id}: ${res.data.message}`);
        // Có thể lưu lại hoặc xóa tùy policy. Ở đây tôi giữ lại để thử lại sau.
      }
    } catch (error) {
      console.error('❌ Sync failed for log:', log.id, error.message);
    }
  }
};

