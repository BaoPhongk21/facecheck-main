import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Platform, TextInput, Modal, Image, StatusBar } from 'react-native';


import { useCameraPermissions, CameraView } from 'expo-camera';
// import * as FaceDetector from 'expo-face-detector'; // Tạm đóng vì không hỗ trợ Expo Go mới
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

  // State cho chế độ Quét tự động (1 bước)
  const [isScanning, setIsScanning] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState(0);
  const [hasFace, setHasFace] = useState(false);




  useEffect(() => {
    OfflineManager.initDB();

    // Sync logs every 1 minute
    const syncInterval = setInterval(() => {
      OfflineManager.syncLogs(BACKEND_URL);
    }, 60000);

    return () => clearInterval(syncInterval);
  }, []);

  // Tự động quét khuôn mặt liên tục
  useEffect(() => {
    let timer;
    if (isScanning && !loading && !result && !showLogin) {
      timer = setInterval(() => {
        handleQuickScan();
      }, 1000); // Thử quét mỗi 1 giây
    }
    return () => clearInterval(timer);
  }, [isScanning, loading, result, showLogin]);

  const handleQuickScan = async () => {
    if (!cameraRef.current || loading || result) return;
    
    // Tránh quét quá dày đặc
    const now = Date.now();
    if (now - lastCheckTime < 1500) return;
    setLastCheckTime(now);

    try {
      const photo = await cameraRef.current.takePictureAsync({ 
        base64: true, 
        quality: 0.5, // Tăng lên 0.5 để AI nhận diện chuẩn hơn
        skipProcessing: true 
      });


      
      // Gọi endpoint Quick Scan (Gộp Liveness + Identify)
      const res = await axios.post(`${BACKEND_URL}/api/face/quick-scan`, 
        { image_base64: photo.base64 },
        { headers: LT_HEADERS, timeout: 10000 }
      );

      if (res.data.matched) {
        const employee = res.data.employee;
        
        // Ghi nhận điểm danh ngay
        const endpoint = checkType === 'IN' ? '/api/attendance/checkin' : '/api/attendance/checkout';
        const attRes = await axios.post(`${BACKEND_URL}${endpoint}`, {
          employeeId: employee.id,
          confidenceScore: res.data.confidence / 100,
          type: checkType
        }, { headers: LT_HEADERS });

        setResult({
          type: 'success',
          message: `Xin chào, ${employee.fullName}!`,
          employee: { ...employee, department: employee.department },
          time: attRes.data.log?.checkTime
        });

        // Tự động ẩn kết quả sau 4 giây để quét người tiếp theo
        setTimeout(() => {
          setResult(null);
        }, 4000);
      }
    } catch (e) {
      console.log('Quick scan error:', e.message);
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






  // Xử lý phát hiện khuôn mặt
  const handleFacesDetected = ({ faces }) => {
    setHasFace(faces.length > 0);
  };

  /* 
  if (loading || isAdmin || faces.length === 0 || result || status === 'Đang xử lý...') return;
  // ... logic nháy mắt cũ ...
  */

  const challengeNames = {
    blink: 'Hãy NHÁY MẮT',
    left: 'Hãy quay đầu sang TRÁI',
    right: 'Hãy quay đầu sang PHẢI'
  };

  const startAttendance = () => {
    // Tạo chuỗi ngẫu nhiên
    const baseActions = ['blink', 'left', 'right'];
    const randomSeq = baseActions.sort(() => Math.random() - 0.5);
    
    setChallengeSequence(randomSeq);
    setCurrentStep(1);
    setStatus(`Bước 1: ${challengeNames[randomSeq[0]]}`);
    setResult(null);
    setLivenessImages({ img1: null, img2: null, img3: null });
  };

  const captureStep = async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      const base64 = `data:image/jpg;base64,${photo.base64}`;

      if (currentStep === 1) {
        setLivenessImages(prev => ({ ...prev, img1: base64 }));
        setCurrentStep(2);
        setStatus(`Bước 2: ${challengeNames[challengeSequence[1]]}`);
      } else if (currentStep === 2) {
        setLivenessImages(prev => ({ ...prev, img2: base64 }));
        setCurrentStep(3);
        setStatus(`Bước 3: ${challengeNames[challengeSequence[2]]}`);
      } else if (currentStep === 3) {
        const finalImages = { ...livenessImages, img3: base64 };
        setLivenessImages(finalImages);
        handleVerifySequence(finalImages);
      }
    } catch (e) {
      console.error(e);
      setResult({ type: 'error', message: 'Lỗi khi chụp ảnh' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySequence = async (images) => {
    setLoading(true);
    setCurrentStep(4);
    setStatus('Đang xác minh chuỗi hành động...');

    try {
      const aiRes = await axios.post(`${BACKEND_URL}/api/v1/verify_sequence`, {
        image_1: images.img1,
        image_2: images.img2,
        image_3: images.img3,
        sequence: challengeSequence
      }, { headers: LT_HEADERS, timeout: API_TIMEOUT });


      if (!aiRes.data.success) {
        setResult({ type: 'error', message: aiRes.data.error });
        setCurrentStep(0);
        return;
      }

      // 2. Nếu liveness ok, tiến hành nhận diện (Backend đã trả về embedding)
      setStatus('Đang nhận diện khuôn mặt...');
      const idRes = await axios.post(`${BACKEND_URL}/api/face/identify`, {
        embedding: aiRes.data.embedding,
        livenessScore: 1.0
      }, { headers: LT_HEADERS, timeout: API_TIMEOUT });

      if (!idRes.data.matched) {
        setResult({ type: 'error', message: 'Khuôn mặt không có trong hệ thống.' });
        setCurrentStep(0);
        return;
      }

      const employee = idRes.data.employee;
      const endpoint = checkType === 'IN' ? '/api/attendance/checkin' : '/api/attendance/checkout';
      
      setStatus(`Ghi nhận giờ ${checkType === 'IN' ? 'Vào' : 'Ra'}...`);
      const attRes = await axios.post(`${BACKEND_URL}${endpoint}`, {
        employeeId: employee.id,
        confidenceScore: idRes.data.confidence / 100,
        type: checkType
      }, { headers: LT_HEADERS, timeout: API_TIMEOUT });

      setResult({
        type: 'success',
        message: `Xin chào, ${employee.fullName}!`,
        employee: employee, // Lưu thông tin nhân viên để hiện Card
        time: attRes.data.log?.checkTime
      });

      // Tự động quay lại trạng thái chờ sau 3 giây
      setTimeout(() => {
        setResult(null);
        setCurrentStep(0);
        setStatus('Sẵn sàng điểm danh');
      }, 3500);

    } catch (error) {

      console.error(error);
      setResult({ type: 'error', message: 'Lỗi kết nối máy chủ' });
      setCurrentStep(0);
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
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
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={isAdmin ? "back" : "front"}
          flash="off"
          shutterSound={false}


          /* faceDetectorSettings={{
            mode: FaceDetector.FaceDetectorMode.fast,
            detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
            runClassifications: FaceDetector.FaceDetectorClassifications.all,
            minDetectionInterval: 150,
            tracking: true,
          }} */
        />
        {/* Lớp phủ hướng dẫn */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.scanBox}>
              {!result && !loading && (
                <View style={styles.stepIndicator}>
                  <Text style={styles.stepIndicatorText}>Đang quét khuôn mặt...</Text>
                </View>
              )}
          </View>
        </View>

      </View>

      <View style={styles.footer}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : (
          <>
            {result && result.type === 'success' && result.employee ? (
              <View style={styles.employeeCard}>
                <View style={styles.cardHeader}>
                  {result.employee.avatarUrl ? (
                    <Image source={{ uri: result.employee.avatarUrl }} style={styles.cardAvatar} />
                  ) : (
                    <View style={styles.cardAvatarPlaceholder}>
                      <Text style={styles.avatarText}>{result.employee.fullName.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{result.employee.fullName}</Text>
                    <Text style={styles.cardDept}>{result.employee.department}</Text>
                  </View>
                </View>
                <View style={styles.cardDivider} />
                <View style={styles.cardFooter}>
                  <Text style={styles.checkTimeText}>🕒 {result.time ? new Date(result.time).toLocaleTimeString('vi-VN') : new Date().toLocaleTimeString('vi-VN')}</Text>
                  <Text style={styles.successBadge}>ĐÃ GHI NHẬN</Text>
                </View>
              </View>
            ) : result && (
              <View style={[styles.resultBox, result.type === 'success' ? styles.resultSuccess : styles.resultError]}>
                <Text style={styles.resultText}>{result.message}</Text>
              </View>
            )}

            {!result && (
              <Text style={styles.instructionText}>
                {isAdmin ? 'Đang ở chế độ Admin' : `Vui lòng đưa mặt vào khung hình để điểm danh`}
              </Text>
            )}
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
    </View>
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
  activeStepButton: {
    backgroundColor: 'rgba(234, 179, 8, 0.3)',
    borderColor: '#eab308',
    borderWidth: 2,
  },
  stepIndicator: {
    backgroundColor: 'rgba(234, 179, 8, 0.9)',
    padding: 10,
    borderRadius: 8,
    position: 'absolute',
    top: -50,
    width: '120%',
    left: '-10%',
    alignItems: 'center',
  },
  stepIndicatorText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },


  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 140, // Hình tròn cho đẹp
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
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
  employeeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderLeftWidth: 5,
    borderLeftColor: '#10b981',
    marginVertical: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  cardAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  cardDept: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkTimeText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  successBadge: {
    backgroundColor: '#ecfdf5',
    color: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
