import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

const db = SQLite.openDatabaseSync('attendance.db');

export const initDB = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS offline_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId TEXT,
      type TEXT,
      confidenceScore REAL,
      timestamp TEXT
    );
  `);
};

export const saveLogOffline = (log) => {
  const { employeeId, type, confidenceScore } = log;
  const timestamp = new Date().toISOString();
  db.runSync(
    'INSERT INTO offline_logs (employeeId, type, confidenceScore, timestamp) VALUES (?, ?, ?, ?)',
    [employeeId, type, confidenceScore, timestamp]
  );
  console.log('📦 Log saved offline');
};

export const syncLogs = async (backendUrl) => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const logs = db.getAllSync('SELECT * FROM offline_logs');
  if (logs.length === 0) return;

  console.log(`🔄 Syncing ${logs.length} logs...`);

  for (const log of logs) {
    try {
      const endpoint = log.type === 'IN' ? '/api/attendance/checkin' : '/api/attendance/checkout';
      await axios.post(`${backendUrl}${endpoint}`, {
        employeeId: log.employeeId,
        confidenceScore: log.confidenceScore,
        timestamp: log.timestamp // Backend may need to handle custom timestamp
      });
      
      // Delete synced log
      db.runSync('DELETE FROM offline_logs WHERE id = ?', [log.id]);
    } catch (error) {
      console.error('❌ Sync failed for log:', log.id, error.message);
    }
  }
};
