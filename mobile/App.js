import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform, TextInput, Modal } from 'react-native';
import { useCameraPermissions, Camera } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';
import axios from 'axios';
import * as OfflineManager from './src/services/OfflineManager';
import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';
import { ScrollView } from 'react-native';

import { BACKEND_URL, AI_SERVICE_URL, LT_HEADERS, API_TIMEOUT } from './src/config/api';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Sẵn sàng điểm danh');
  const [result, setResult] = useState(null);
  const [checkType, setCheckType] = useState('IN'); // 'IN' or 'OUT'
  const [isAdmin, setIsAdmin] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminToken, setAdminToken] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // State cho Liveness Detection
  const [isEyeClosed, setIsEyeClosed] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);

  useEffect(() => {
    OfflineManager.initDB();

    // Sync logs every 1 minute
    const syncInterval = setInterval(() => {
      OfflineManager.syncLogs(BACKEND_URL);
    }, 60000);

    return () => clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    if (isAdmin && adminToken) {
      fetchEmployees();
    }
  }, [isAdmin, adminToken]);

  const fetchEmployees = async () => {
    if (!adminToken) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/api/employees`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          ...LT_HEADERS
        },
        timeout: API_TIMEOUT
      });
      setEmployees(res.data);
    } catch (error) {
      console.error('Lỗi tải nhân viên:', error);
      if (error.response?.status === 401) {
        setIsAdmin(false);
        setAdminToken(null);
      }
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/login`,
        { username, password },
        { headers: LT_HEADERS, timeout: API_TIMEOUT }
      );
      if (res.data.token && (res.data.user.role === 'SUPER_ADMIN' || res.data.user.role === 'HR')) {
        setAdminToken(res.data.token);
        setShowLogin(false);
        setIsAdmin(true);
        setResult({ type: 'success', message: 'Đăng nhập Admin thành công' });
      } else {
        setResult({ type: 'error', message: 'Bạn không có quyền Admin' });
      }
    } catch (error) {
      setResult({ type: 'error', message: 'Sai tài khoản hoặc mật khẩu' });
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>App cần quyền truy cập Camera để điểm danh</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Cấp quyền Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Xử lý phát hiện khuôn mặt và nháy mắt
  const handleFacesDetected = ({ faces }) => {
    if (loading || isAdmin || faces.length === 0 || result || status === 'Đang xử lý...') return;

    const face = faces[0];
    // Xác suất mở mắt (0.0 đến 1.0)
    const leftEye = face.leftEyeOpenProbability;
    const rightEye = face.rightEyeOpenProbability;

    if (leftEye !== undefined && rightEye !== undefined) {
      const isClosed = leftEye < 0.3 && rightEye < 0.3;
      const isOpen = leftEye > 0.7 && rightEye > 0.7;

      if (isClosed && !isEyeClosed) {
        setIsEyeClosed(true);
      } else if (isOpen && isEyeClosed) {
        setIsEyeClosed(false);
        setBlinkCount(prev => prev + 1);
        console.log('✅ Blink detected!');

        // Kích hoạt điểm danh ngay khi phát hiện 1 lần nháy mắt
        if (!loading) {
          handleAttendance();
        }
      }
    }

    const nextStatus = isEyeClosed ? 'Tốt, bây giờ hãy mở mắt...' : 'Hãy nháy mắt để điểm danh';
    if (faces.length > 0 && status !== nextStatus && !loading) {
      setStatus(nextStatus);
    }
  };

  const handleAttendance = async () => {
    if (!cameraRef.current) return;

    setLoading(true);
    setStatus('Đang xử lý...');
    setBlinkCount(0);
    setResult(null);

    try {
      const state = await NetInfo.fetch();
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });

      if (!state.isConnected) {
        // Chế độ Offline
        OfflineManager.saveLogOffline({
          employeeId: 'OFFLINE_PENDING', // Will need recognition later or manual ID
          type: checkType,
          confidenceScore: 1.0
        });
        setResult({ type: 'success', message: 'Mất mạng! Đã lưu điểm danh ngoại tuyến.' });
        setLoading(false);
        setStatus('Sẵn sàng điểm danh');
        return;
      }

      // 2. Trích xuất khuôn mặt (AI Service)
      // SỬA LỖI: Sử dụng BACKEND_URL làm proxy thay vì gọi trực tiếp AI_SERVICE_URL
      const aiRes = await axios.post(`${BACKEND_URL}/api/v1/extract`,
        { image_base64: photo.base64 },
        { headers: LT_HEADERS, timeout: API_TIMEOUT }
      );

      // Giả sử AI Service trả về thêm trường liveness_score (0.0 - 1.0)
      if (!aiRes.data.success || aiRes.data.liveness_score < 0.8) {
        const errorMsg = aiRes.data.liveness_score < 0.8
          ? 'Phát hiện giả mạo (Spoofing detected)!'
          : (aiRes.data.error || 'Không nhận diện được khuôn mặt.');
        setResult({ type: 'error', message: errorMsg });
        setLoading(false);
        return;
      }

      // 3. Nhận diện nhân viên (Node.js Backend)
      setStatus('Đang tìm kiếm hồ sơ nhân viên...');
      const idRes = await axios.post(`${BACKEND_URL}/api/face/identify`,
        {
          embedding: aiRes.data.embedding,
          livenessScore: aiRes.data.liveness_score
        },
        { headers: LT_HEADERS, timeout: API_TIMEOUT }
      );

      if (!idRes.data.matched) {
        setResult({ type: 'error', message: 'Khuôn mặt không có trong hệ thống.' });
        setLoading(false);
        return;
      }

      const employee = idRes.data.employee;

      // 4. Ghi nhận điểm danh
      const endpoint = checkType === 'IN' ? '/api/attendance/checkin' : '/api/attendance/checkout';
      setStatus(`Đang ghi nhận giờ ${checkType === 'IN' ? 'Vào ca' : 'Ra ca'}...`);

      const attRes = await axios.post(`${BACKEND_URL}${endpoint}`, {
        employeeId: employee.id,
        confidenceScore: idRes.data.confidence / 100,
        type: checkType
      }, { headers: LT_HEADERS, timeout: API_TIMEOUT });

      setResult({
        type: 'success',
        message: `Xin chào ${employee.fullName}!\n${attRes.data.message}`,
        time: attRes.data.log?.checkTime,
        workHours: attRes.data.log?.workHours
      });

    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || error.response?.data?.detail || 'Lỗi kết nối máy chủ';
      setResult({ type: 'error', message: msg });
    } finally {
      setLoading(false);
      setStatus('Sẵn sàng điểm danh');
    }
  };

  const handleEnrollment = async () => {
    if (!cameraRef.current || !selectedEmployee) return;

    setLoading(true);
    setStatus('Đang lấy mẫu khuôn mặt...');
    setResult(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });

      // 1. Trích xuất embedding
      // SỬA LỖI: Sử dụng Backend Proxy cho đăng ký khuôn mặt
      const aiRes = await axios.post(`${BACKEND_URL}/api/v1/extract`,
        { image_base64: photo.base64 },
        { headers: LT_HEADERS, timeout: API_TIMEOUT }
      );

      if (!aiRes.data.success) {
        setResult({ type: 'error', message: aiRes.data.error });
        setLoading(false);
        return;
      }

      // 2. Cập nhật vào Backend
      await axios.put(`${BACKEND_URL}/api/employees/${selectedEmployee}`, {
        faceEmbedding: aiRes.data.embedding
      }, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          ...LT_HEADERS
        },
        timeout: API_TIMEOUT
      });

      setResult({ type: 'success', message: 'Đăng ký khuôn mặt thành công!' });
    } catch (error) {
      console.error(error);
      setResult({ type: 'error', message: 'Lỗi đăng ký khuôn mặt' });
    } finally {
      setLoading(false);
      setStatus('Admin Mode');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{isAdmin ? 'Face Enrollment' : 'BioHR Mobile Kiosk'}</Text>
          <TouchableOpacity
            onPress={() => isAdmin ? setIsAdmin(false) : setShowLogin(true)}
            style={styles.adminToggle}
          >
            <Text style={styles.adminToggleText}>{isAdmin ? 'Thoát Admin' : 'Đăng nhập Admin'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>{isAdmin ? 'Chọn nhân viên và quét mặt để đăng ký' : 'Giơ khuôn mặt vào giữa khung hình'}</Text>

        {isAdmin ? (
          <View style={styles.adminContainer}>
            <TextInput
              placeholder="Nhập Mã hoặc Tên để tìm..."
              style={styles.searchBar}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#94a3b8"
            />
            <ScrollView style={styles.resultsList} nestedScrollEnabled={true}>
              {employees
                .filter(e =>
                  e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  e.employeeCode.includes(searchQuery)
                )
                .slice(0, 5) // Show top 5 matches
                .map(emp => (
                  <TouchableOpacity
                    key={emp.id}
                    style={[styles.resultItem, selectedEmployee === emp.id && styles.resultItemActive]}
                    onPress={() => {
                      setSelectedEmployee(emp.id);
                      setSearchQuery(`${emp.name} (${emp.employeeCode})`);
                    }}
                  >
                    <Text style={[styles.resultItemText, selectedEmployee === emp.id && styles.resultItemTextActive]}>
                      {emp.name} ({emp.employeeCode})
                    </Text>
                  </TouchableOpacity>
                ))}
              {employees.length === 0 && (
                <Text style={styles.emptyText}>Đang tải hoặc không có dữ liệu...</Text>
              )}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, checkType === 'IN' && styles.toggleBtnActive]}
              onPress={() => setCheckType('IN')}
            >
              <Text style={[styles.toggleText, checkType === 'IN' && styles.toggleTextActive]}>VÀO CA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, checkType === 'OUT' && styles.toggleBtnActive]}
              onPress={() => setCheckType('OUT')}
            >
              <Text style={[styles.toggleText, checkType === 'OUT' && styles.toggleTextActive]}>RA CA</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={isAdmin ? "back" : "front"}
          onFacesDetected={handleFacesDetected}
          faceDetectorSettings={{
            mode: FaceDetector.FaceDetectorMode.fast,
            detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
            runClassifications: FaceDetector.FaceDetectorClassifications.all,
            minDetectionInterval: 150,
            tracking: true,
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanBox} />
          </View>
        </Camera>
      </View>

      <View style={styles.footer}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : (
          <>
            {blinkCount > 0 && <Text style={styles.blinkFeedback}>Đã nhận diện nháy mắt! 👁️✅</Text>}
            {result && (
              <View style={[styles.resultBox, result.type === 'success' ? styles.resultSuccess : styles.resultError]}>
                <Text style={styles.resultText}>{result.message}</Text>
                {result.time && <Text style={styles.timeText}>Thời gian: {new Date(result.time).toLocaleTimeString('vi-VN')}</Text>}
                {result.workHours && <Text style={styles.workHoursText}>Số giờ làm: {result.workHours}h</Text>}
              </View>
            )}

            <TouchableOpacity
              style={[styles.captureButton, isAdmin && styles.enrollButton]}
              onPress={isAdmin ? handleEnrollment : handleAttendance}
            >
              <View style={[styles.captureButtonInner, isAdmin && styles.enrollButtonInner]} />
            </TouchableOpacity>
            <Text style={styles.instructionText}>
              {isAdmin ? 'Bấm để Đăng ký Khuôn mặt' : `Bấm để Điểm danh ${checkType === 'IN' ? 'Vào ca' : 'Ra ca'}`}
            </Text>
          </>
        )}
      </View>

      <Modal visible={showLogin} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Admin Login</Text>
            <TextInput
              placeholder="Tài khoản"
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              placeholder="Mật khẩu"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
              <Text style={styles.loginBtnText}>Đăng nhập</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLogin(false)}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  adminToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  adminToggleText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 5,
    marginBottom: 15,
  },
  adminContainer: {
    width: '90%',
    marginTop: 10,
  },
  searchBar: {
    backgroundColor: '#ffffff',
    height: 45,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 5,
    fontSize: 14,
    color: '#000',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  resultsList: {
    maxHeight: 150,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 5,
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  resultItemActive: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  resultItemText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  resultItemTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    padding: 10,
    fontSize: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    width: '80%',
    marginTop: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#3b82f6',
  },
  toggleText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#334155',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: 250,
    height: 300,
    borderWidth: 3,
    borderColor: '#3b82f6',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  footer: {
    padding: 30,
    alignItems: 'center',
    minHeight: 200,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  captureButtonInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#ffffff',
  },
  enrollButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  enrollButtonInner: {
    backgroundColor: '#3b82f6',
  },
  instructionText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statusText: {
    color: '#60a5fa',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    padding: 15,
    borderRadius: 16,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  resultSuccess: {
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#059669',
  },
  resultError: {
    backgroundColor: '#7f1d1d',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  resultText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeText: {
    color: '#a7f3d0',
    fontSize: 14,
    marginTop: 5,
    fontWeight: '500',
  },
  workHoursText: {
    color: '#fbbf24',
    fontSize: 14,
    marginTop: 2,
    fontWeight: '600',
  },
  blinkFeedback: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginCard: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#f8fafc',
    color: '#000',
  },
  loginBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelBtn: {
    marginTop: 15,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 14,
  }
});
