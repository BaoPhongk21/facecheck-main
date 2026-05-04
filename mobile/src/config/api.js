// File: mobile/src/config/api.js

// URL này sẽ được script tự động cập nhật khi bạn chạy tunnel.
// Nếu chạy thủ công, hãy dán URL .trycloudflare.com vào đây.
export const BACKEND_URL = `http://192.168.1.155:5000`; 
export const AI_SERVICE_URL = BACKEND_URL; // Dùng chung URL với Backend (Proxy)

export const LT_HEADERS = { 
  'Bypass-Tunnel-Reminder': 'true' 
};

export const API_TIMEOUT = 30000; // 30 giây
