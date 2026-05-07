import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

const AdminFaceScanner = ({ mode = 'ATTENDANCE', onResult }) => {
    const webcamRef = useRef(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState('Đang chờ khuôn mặt...');
    const [lastMatched, setLastMatched] = useState(null);

    // Tự động quét mỗi 2 giây nếu không đang xử lý
    useEffect(() => {
        const timer = setInterval(() => {
            if (!isProcessing) captureAndScan();
        }, 2000);
        return () => clearInterval(timer);
    }, [isProcessing]);

    const captureAndScan = async () => {
        if (!webcamRef.current) return;

        const imageBase64 = webcamRef.current.getScreenshot();
        if (!imageBase64) return;

        setIsProcessing(true);
        setStatus('Đang phân tích...');

        try {
            const base64Data = imageBase64.split(',')[1];
            const res = await axios.post('http://localhost:5000/api/face/auto-attendance', {
                image_base64: base64Data,
                type: 'IN' // Có thể thay đổi dựa trên UI toggle
            });

            if (res.data.matched) {
                setStatus(res.data.message);
                setLastMatched(res.data.employee);
                if (onResult) onResult(res.data);

                // Đợi 3 giây hiển thị thông báo rồi reset để tránh quét trùng lặp ngay lập tức
                setTimeout(() => {
                    setIsProcessing(false);
                    setStatus('Đang chờ khuôn mặt...');
                }, 3000);
            } else {
                setIsProcessing(false);
                setStatus('Không nhận diện được. Vui lòng thử lại.');
            }
        } catch (error) {
            setIsProcessing(false);
            setStatus(error.response?.data?.error || 'Lỗi hệ thống');
        }
    };

    return (
        <div className="flex flex-col items-center p-6 bg-slate-900 rounded-2xl shadow-xl border border-slate-700">
            <div className="relative w-80 h-80 rounded-full overflow-hidden border-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover scale-x-[-1]"
                />
                {isProcessing && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            <div className="mt-6 text-center">
                <p className={`text-lg font-bold ${isProcessing ? 'text-blue-400' : 'text-slate-300'}`}>
                    {status}
                </p>

                {lastMatched && (
                    <div className="mt-4 p-4 bg-slate-800 rounded-lg animate-fade-in">
                        <div className="flex items-center gap-3">
                            <img
                                src={lastMatched.avatarUrl || 'https://via.placeholder.com/40'}
                                alt="Avatar"
                                className="w-12 h-12 rounded-full border border-blue-400"
                            />
                            <div className="text-left">
                                <p className="text-white font-bold">{lastMatched.fullName}</p>
                                <p className="text-slate-400 text-sm">{lastMatched.department}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <button
                onClick={() => { setLastMatched(null); setIsProcessing(false); }}
                className="mt-6 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
                Quét lại
            </button>
        </div>
    );
};

export default AdminFaceScanner;