// frontend/pages/verify-otp.js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import toast from 'react-hot-toast';
import { FiShield, FiRefreshCw } from 'react-icons/fi';
import useAuthStore from '../store/authStore';
import { authAPI } from '../utils/apiClient';

export default function VerifyOTP() {
  const router = useRouter();
  const { phone } = router.query;
  const verifyOTP = useAuthStore((state) => state.verifyOTP);
  const loading = useAuthStore((state) => state.loading);

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Handle OTP input change
  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = pastedData.split('');
    setOtp([...newOtp, ...Array(6 - newOtp.length).fill('')]);
    
    // Focus last filled input
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  // Submit OTP
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      toast.error('Please enter complete OTP');
      return;
    }

    if (!phone) {
      toast.error('Phone number is missing');
      return;
    }

    try {
      const response = await verifyOTP({
        phone: phone,
        code: otpCode,
      });

      if (response.success) {
        toast.success('Phone verified successfully!');
        router.push('/');
      }
    } catch (error) {
      // Error handled by apiClient interceptor
      console.error('OTP verification error:', error);
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (!canResend) return;

    try {
      const response = await authAPI.resendOTP(phone);
      
      if (response.success) {
        toast.success('New OTP sent successfully!');
        setResendTimer(60);
        setCanResend(false);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
    }
  };

  if (!phone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Invalid verification link</p>
          <button 
            onClick={() => router.push('/signup')}
            className="btn-primary mt-4"
          >
            Go to Signup
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Verify OTP - Services Marketplace</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
              <FiShield className="text-primary-600" size={40} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Verify Your Phone
            </h1>
            <p className="text-gray-600">
              We've sent a 6-digit code to
            </p>
            <p className="text-primary-600 font-semibold mt-1">
              {phone}
            </p>
          </div>

          {/* OTP Card */}
          <div className="card">
            <form onSubmit={handleSubmit}>
              {/* OTP Input */}
              <div className="flex justify-center gap-3 mb-6">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-primary-600 focus:ring-2 focus:ring-primary-200 transition-all"
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="btn-primary w-full"
              >
                {loading ? (
                  <>
                    <div className="spinner border-2 border-white border-t-transparent w-5 h-5 mx-auto"></div>
                  </>
                ) : (
                  'Verify & Continue'
                )}
              </button>
            </form>

            {/* Resend OTP */}
            <div className="mt-6 text-center">
              {canResend ? (
                <button
                  onClick={handleResend}
                  className="text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center gap-2 mx-auto"
                >
                  <FiRefreshCw size={18} />
                  Resend OTP
                </button>
              ) : (
                <p className="text-gray-600 text-sm">
                  Resend OTP in <span className="font-semibold text-primary-600">{resendTimer}s</span>
                </p>
              )}
            </div>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 Development Mode:</strong> Check your backend console for the OTP code.
              </p>
            </div>
          </div>

          {/* Back to Signup */}
          <div className="text-center mt-6">
            <button
              onClick={() => router.push('/signup')}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              ← Back to Signup
            </button>
          </div>
        </div>
      </div>
    </>
  );
}