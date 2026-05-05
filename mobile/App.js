import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform, TextInput, Modal } from 'react-native';
import { useCameraPermissions, CameraView } from 'expo-camera';
// import * as FaceDetector from 'expo-face-detector'; // Module này không còn hỗ trợ trên Expo Go mới
import axios from 'axios';
import * as OfflineManager from './src/services/OfflineManager';
import NetInfo from '@react-native-community/netinfo';
import * as Speech from 'expo-speech';
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

  const [livenessStep, setLivenessStep] = useState(0); // 0: Idle, 1: Center, 2: Blink, 3: Tilt
  const [capturedImages, setCapturedImages] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  useEffect(() => {
    OfflineManager.initDB();
    setupVoices();

    // Sync logs every 1 minute
    const syncInterval = setInterval(() => {
      OfflineManager.syncLogs(BACKEND_URL);
    }, 60000);

    return () => clearInterval(syncInterval);
  }, []);

  const setupVoices = async () => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const vnVoices = voices.filter(v => v.language.includes('vi'));

      // Tìm giọng Nam (Ưu tiên các tên giọng nam phổ biến trên Android/iOS)
      const maleVoice = vnVoices.find(v =>
        v.name.toLowerCase().includes('minh') ||
        v.name.toLowerCase().includes('nam') ||
        v.name.toLowerCase().includes('an') ||
        v.name.toLowerCase().includes('mạnh') ||
        v.name.toLowerCase().includes('male')
      ) || vnVoices[0];

      if (maleVoice) {
        setSelectedVoice(maleVoice.identifier);
      }
    } catch (e) {
      console.log('Voice setup log:', e.message);
    }
  };

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
      console.log('Employee fetch log:', error.message);
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
      const msg = error.response?.data?.error || error.message || 'Lỗi kết nối server';
      setResult({ type: 'error', message: `Đăng nhập thất bại: ${msg}` });
      console.log('Login error:', error);
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

  // Tạm thời tắt nhận diện nháy mắt local do Expo Go không hỗ trợ module native
  const handleFacesDetected = ({ faces }) => {
    // Logic này yêu cầu Development Build, không chạy được trên Expo Go mới.
    // Chúng ta sẽ dùng nút bấm để chụp ảnh và AI Service sẽ kiểm tra liveness.
  };

  // Hàm phát giọng nói hướng dẫn (Đã ưu tiên giọng Nam)
  const speak = (text) => {
    Speech.stop();
    Speech.speak(text, {
      language: 'vi-VN',
      pitch: 0.9,  // Hạ cao độ xuống một chút để giọng trầm hơn (giọng Nam)
      rate: 1.0,
      voice: selectedVoice,
    });
  };

  const handleAttendance = async () => {
    if (!cameraRef.current || loading) return;

    setLoading(true);
    setResult(null);
    let capturedImg = null;

    try {
      // Kiểm tra kết nối mạng trước khi bắt đầu
      const netState = await NetInfo.fetch();

      // BƯỚC 1: NHÌN THẲNG (3 GIÂY)
      setLivenessStep(1);
      const msg1 = 'Bước 1: Vui lòng nhìn thẳng vào camera trong 3 giây';
      setStatus(msg1);
      speak(msg1);
      await new Promise(r => setTimeout(r, 2000));
      const img1 = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      capturedImg = img1.base64;

      // Nếu offline, cho phép lưu offline luôn sau bước 1 (bỏ qua liveness check vì không có server)
      if (!netState.isConnected) {
        OfflineManager.saveLogOffline(capturedImg, checkType);
        const offMsg = 'Đã lưu điểm danh ngoại tuyến. Dữ liệu sẽ tự động đồng bộ khi có mạng.';
        setResult({ type: 'success', message: offMsg });
        speak(offMsg);
        return;
      }

      // Kiểm tra bước 1 (Online)
      setStatus('Đang kiểm tra tư thế nhìn thẳng...');
      const check1 = await axios.post(`${BACKEND_URL}/api/v1/liveness-check`, { image_base64: capturedImg }, { headers: LT_HEADERS });
      if (!check1.data.face_detected || check1.data.pose !== 'CENTER') {
        throw new Error('Bạn chưa nhìn thẳng vào khung hình ở bước 1.');
      }

      // BƯỚC 2: NHÁY MẮT (3 GIÂY)
      setLivenessStep(2);
      const msg2 = 'Bước 2:Bây giờ hãy nháy mắt liên tục';
      setStatus(msg2);
      speak(msg2);
      await new Promise(r => setTimeout(r, 2000));
      const img2 = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });

      // Kiểm tra bước 2
      setStatus('Đang kiểm tra nháy mắt...');
      const check2 = await axios.post(`${BACKEND_URL}/api/v1/liveness-check`, { image_base64: img2.base64 }, { headers: LT_HEADERS });
      if (check2.data.eyes !== 'CLOSED' && check2.data.ear > 0.25) { // Nới lỏng EAR từ 0.22 lên 0.25
        console.log('Blink failed, but proceeding if EAR is low enough:', check2.data.ear);
        // Nếu không phát hiện nhắm hẳn nhưng EAR giảm đáng kể, vẫn cho qua
        if (check2.data.ear > 0.30) throw new Error('Hệ thống không thấy bạn nháy mắt ở bước 2.');
      }

      // BƯỚC 3: NGHIÊNG MẶT (4 GIÂY)
      setLivenessStep(3);
      const msg3 = 'Bước 3: Nghiêng đầu sang một bên';
      setStatus(msg3);
      speak(msg3);
      await new Promise(r => setTimeout(r, 2000));
      const img3 = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });

      // Kiểm tra bước 3
      setStatus('Đang kiểm tra nghiêng đầu...');
      const check3 = await axios.post(`${BACKEND_URL}/api/v1/liveness-check`, { image_base64: img3.base64 }, { headers: LT_HEADERS });
      if (check3.data.pose === 'CENTER') {
        throw new Error('Vui lòng nghiêng đầu sang trái hoặc phải ở bước 3.');
      }

      setLivenessStep(0);
      const msgFinal = 'Xác thực thành công! Đang đối chiếu hồ sơ...';
      setStatus(msgFinal);
      speak(msgFinal);

      // Gửi ảnh 1 để nhận diện
      const aiRes = await axios.post(`${BACKEND_URL}/api/v1/extract`,
        { image_base64: capturedImg },
        { headers: LT_HEADERS, timeout: API_TIMEOUT }
      );

      if (!aiRes.data.success) {
        throw new Error(aiRes.data.error || 'Lỗi nhận diện khuôn mặt');
      }

      const idRes = await axios.post(`${BACKEND_URL}/api/face/identify`,
        {
          embedding: aiRes.data.embedding,
          livenessScore: 0.99
        },
        { headers: LT_HEADERS, timeout: API_TIMEOUT }
      );

      if (!idRes.data.matched) {
        throw new Error('Khuôn mặt không khớp với hồ sơ nhân viên nào.');
      }

      const employee = idRes.data.employee;
      const endpoint = checkType === 'IN' ? '/api/attendance/checkin' : '/api/attendance/checkout';

      const attRes = await axios.post(`${BACKEND_URL}${endpoint}`, {
        employeeId: employee.id,
        confidenceScore: idRes.data.confidence / 100,
        type: checkType
      }, { headers: LT_HEADERS, timeout: API_TIMEOUT });

      const typeText = checkType === 'IN' ? 'Chào mừng' : 'Cảm ơn';
      let successMsg = `${typeText} ${employee.fullName} đã điểm danh thành công.`;

      if (checkType === 'OUT' && attRes.data.log?.workHours) {
        successMsg += `\nThời gian làm việc: ${attRes.data.log.workHours} giờ.`;
      }

      setResult({ type: 'success', message: successMsg, time: attRes.data.log?.checkTime });
      speak(successMsg);

    } catch (error) {
      console.log('Attendance process log:', error.message);

      // Xử lý lỗi kết nối (Server chết hoặc mất mạng đột ngột)
      if ((error.message.includes('Network Error') || error.code === 'ECONNABORTED') && capturedImg) {
        OfflineManager.saveLogOffline(capturedImg, checkType);
        const offMsg = 'Lỗi kết nối! Đã tự động lưu điểm danh ngoại tuyến.';
        setResult({ type: 'success', message: offMsg });
        speak(offMsg);
      } else {
        const errorMsg = error.response?.data?.error || error.message || 'Lỗi quy trình, vui lòng thử lại';
        setResult({ type: 'error', message: errorMsg });
        speak(errorMsg);
      }
    } finally {
      setLoading(false);
      setLivenessStep(0);
      setStatus('Sẵn sàng điểm danh');
    }
  };


  const handleEnrollment = async () => {
    if (!cameraRef.current || !selectedEmployee || loading) return;

    setLoading(true);
    setResult(null);

    try {
      // BƯỚC 1: NHÌN THẲNG (3 GIÂY)
      setLivenessStep(1);
      const emp = employees.find(e => e.id === selectedEmployee);
      const msg1 = `Bắt đầu đăng ký cho ${emp?.name || 'nhân viên'}. Bước 1: Nhìn thẳng 2 giây.`;
      setStatus(msg1);
      speak(msg1);
      await new Promise(r => setTimeout(r, 2000));
      const img1 = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });

      setStatus('Đang kiểm tra mẫu nhìn thẳng...');
      const check1 = await axios.post(`${BACKEND_URL}/api/v1/liveness-check`, { image_base64: img1.base64 }, { headers: LT_HEADERS });
      if (!check1.data.face_detected || check1.data.pose !== 'CENTER') {
        throw new Error('Vui lòng nhìn thẳng vào camera để lấy mẫu chuẩn.');
      }

      // BƯỚC 2: NHÁY MẮT (3 GIÂY)
      setLivenessStep(2);
      const msg2 = 'Bước 2: Nháy mắt liên tục để xác thực người thật.';
      setStatus(msg2);
      speak(msg2);
      await new Promise(r => setTimeout(r, 2000));
      const img2 = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });

      setStatus('Đang kiểm tra nháy mắt...');
      const check2 = await axios.post(`${BACKEND_URL}/api/v1/liveness-check`, { image_base64: img2.base64 }, { headers: LT_HEADERS });
      if (check2.data.eyes !== 'CLOSED' && check2.data.ear > 0.25) {
        console.log('Enrollment Blink logic check:', check2.data.ear);
        if (check2.data.ear > 0.30) throw new Error('Đăng ký thất bại: Không nhận diện được hành động nháy mắt.');
      }

      // BƯỚC 3: NGHIÊNG MẶT (3 GIÂY)
      setLivenessStep(3);
      const msg3 = 'Bước 3: Nghiêng đầu nhẹ sang một bên.';
      setStatus(msg3);
      speak(msg3);
      await new Promise(r => setTimeout(r, 3000));
      const img3 = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });

      setStatus('Đang kiểm tra góc nghiêng...');
      const check3 = await axios.post(`${BACKEND_URL}/api/v1/liveness-check`, { image_base64: img3.base64 }, { headers: LT_HEADERS });
      if (check3.data.pose === 'CENTER') {
        throw new Error('Đăng ký thất bại: Vui lòng nghiêng đầu để xác thực 3D.');
      }

      setLivenessStep(0);
      setStatus('Tuyệt vời! Đang xử lý mẫu khuôn mặt...');
      speak('Đã lấy mẫu thành công, đang cập nhật hồ sơ');

      // 1. Trích xuất embedding từ ảnh đẹp nhất (ảnh 1)
      const aiRes = await axios.post(`${BACKEND_URL}/api/v1/extract`,
        { image_base64: img1.base64 },
        { headers: LT_HEADERS, timeout: API_TIMEOUT }
      );

      if (!aiRes.data.success) {
        throw new Error(aiRes.data.error || 'AI không thể trích xuất đặc điểm khuôn mặt.');
      }

      // 2. Cập nhật vào Backend
      await axios.put(`${BACKEND_URL}/api/employees/${selectedEmployee}/face`, {
        faceEmbedding: aiRes.data.embedding
      }, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          ...LT_HEADERS
        }
      });

      const successMsg = `Đã cập nhật khuôn mặt thành công cho ${selectedEmployee.fullName}`;
      setResult({ type: 'success', message: successMsg });
      speak(successMsg);
      fetchEmployees(); // Refresh list

    } catch (error) {
      console.log('Enrollment process log:', error.message);
      const errorMsg = error.response?.data?.error || error.message || 'Lỗi khi đăng ký khuôn mặt';
      setResult({ type: 'error', message: errorMsg });
      speak(errorMsg);
    } finally {
      setLoading(false);
      setLivenessStep(0);
      setStatus('Sẵn sàng');
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
        <Text style={styles.subtitle}>{isAdmin ? 'Chọn nhân viên và bấm để đăng ký' : 'Giơ khuôn mặt vào khung và bấm nút để điểm danh'}</Text>

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
        <CameraView
          key="front_camera"
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        // onFacesDetected={handleFacesDetected}
        // faceDetectorSettings={{
        //   mode: FaceDetector.FaceDetectorMode.fast,
        //   detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
        //   runClassifications: FaceDetector.FaceDetectorClassifications.all,
        //   minDetectionInterval: 150,
        //   tracking: true,
        // }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanBox} />
          </View>
        </CameraView>
      </View>

      <View style={styles.footer}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : (
          <>
            {livenessStep > 0 && (
              <View style={[styles.stepIndicator, livenessStep === 1 ? styles.stepBlue : livenessStep === 2 ? styles.stepYellow : styles.stepGreen]}>
                <Text style={styles.stepIcon}>{livenessStep === 1 ? '👤' : livenessStep === 2 ? '👁️' : '↪️'}</Text>
                <Text style={styles.stepText}>{status}</Text>
              </View>
            )}

            {result && livenessStep === 0 && (
              <View style={[styles.resultBox, result.type === 'success' ? styles.resultSuccess : styles.resultError]}>
                <Text style={styles.resultText}>{result.message}</Text>
                {result.time && <Text style={styles.timeText}>Thời gian: {new Date(result.time).toLocaleTimeString('vi-VN')}</Text>}
              </View>
            )}

            <TouchableOpacity
              style={[styles.captureButton, isAdmin && styles.enrollButton, livenessStep > 0 && styles.captureButtonDisabled]}
              onPress={isAdmin ? handleEnrollment : handleAttendance}
              disabled={livenessStep > 0}
            >
              <View style={[styles.captureButtonInner, isAdmin && styles.enrollButtonInner, livenessStep > 0 && { backgroundColor: '#ccc' }]} />
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
  voiceSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  voiceLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  pickerWrapper: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  picker: {
    color: '#ffffff',
    height: 50,
    width: '100%',
  },
  noVoiceBox: {
    padding: 10,
    backgroundColor: '#334155',
    borderRadius: 12,
  },
  noVoiceText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  refreshBtn: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  hintText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
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
  },
  stepIndicator: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  stepText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  stepBlue: { backgroundColor: '#2563eb', borderColor: '#60a5fa' },
  stepYellow: { backgroundColor: '#d97706', borderColor: '#fbbf24' },
  stepGreen: { backgroundColor: '#059669', borderColor: '#34d399' },
  stepIcon: { fontSize: 24, marginBottom: 5 },
});
