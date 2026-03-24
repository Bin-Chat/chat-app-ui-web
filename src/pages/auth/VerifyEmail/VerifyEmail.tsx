import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, KeyRound, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';

import { useAppDispatch } from '@/hooks/useRedux';
import { setAuth } from '@/store/slices';
import { authServices } from '@/services/authServices';
import { getErrorMessage } from '@/utils/getErrorMessage';

const otpSchema = z.object({
  otp: z
    .string()
    .min(1, 'Vui lòng nhập mã OTP')
    .length(6, 'Mã OTP phải có đúng 6 chữ số')
    .regex(/^\d{6}$/, 'Mã OTP chỉ gồm chữ số'),
});

type OtpFormData = z.infer<typeof otpSchema>;

const RESEND_COOLDOWN = 60;

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const email = (location.state as { email?: string })?.email;

  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpFormData>({ resolver: zodResolver(otpSchema) });

  // Auto-start 60s cooldown on mount (OTP was just sent by register())
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!email) return <Navigate to="/register" replace />;

  const onSubmit = async (data: OtpFormData) => {
    setIsLoading(true);
    try {
      const deviceId = localStorage.getItem('deviceId') || undefined;
      const result = await authServices.verifyRegistration(email, data.otp, deviceId);
      dispatch(setAuth({ user: result.user, isLoggedIn: true }));
      if (result.deviceId) localStorage.setItem('deviceId', result.deviceId);
      toast.success('Đăng ký thành công! Chào mừng đến Bin Chat.');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await authServices.resendVerification(email);
      toast.info('Mã xác thực mới đã được gửi đến email của bạn.');
      setCountdown(RESEND_COOLDOWN);
      // Restart the countdown
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ─── LEFT: Blue Panel ─── */}
      <motion.div
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-[46%] bg-[#0068FF] flex-col items-center justify-center p-14 relative overflow-hidden select-none"
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-white rounded-[22px] flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.18)] mb-6">
            <MessageCircle className="w-12 h-12 text-[#0068FF]" strokeWidth={2.5} />
          </div>

          <h1 className="text-white text-5xl font-bold tracking-tight mb-3">Bin Chat</h1>
          <p className="text-white/75 text-base leading-relaxed max-w-[260px] mb-10">
            Xác thực email để hoàn tất đăng ký
          </p>

          {[
            { Icon: Mail, text: 'Kiểm tra hộp thư của bạn' },
            { Icon: KeyRound, text: 'Mã OTP hiệu lực trong 15 phút' },
            { Icon: ShieldCheck, text: 'Xác thực giúp bảo vệ tài khoản' },
          ].map(({ Icon, text }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.12 }}
              className="flex items-center gap-3 w-full bg-white/10 rounded-2xl px-5 py-3.5 mb-3 text-white"
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={2} />
              <span className="text-sm font-medium">{text}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* ─── RIGHT: Form Panel ─── */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-10">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-11 h-11 bg-[#0068FF] rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-bold text-gray-900">Bin Chat</span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Xác thực email</h2>
          <p className="text-gray-500 text-sm mb-2">Nhập mã 6 chữ số đã gửi đến</p>
          <p className="text-[#0068FF] font-medium text-sm mb-7 truncate">{email}</p>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
            >
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mã OTP</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                <input
                  {...register('otp')}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className={`w-full pl-10 pr-4 py-3 text-sm rounded-xl border outline-none transition-all
                    tracking-[0.3em] font-mono text-center
                    focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
                    ${errors.otp
                      ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-400'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                />
              </div>
              <AnimatePresence>
                {errors.otp && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-red-500 text-xs mt-1.5 overflow-hidden"
                  >
                    {errors.otp.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#0068FF] hover:bg-[#0052CC] active:bg-[#003D99]
                disabled:opacity-60 disabled:cursor-not-allowed
                text-white font-semibold text-sm rounded-xl
                transition-all duration-200 shadow-[0_4px_16px_rgba(0,104,255,0.35)]
                hover:shadow-[0_6px_20px_rgba(0,104,255,0.4)]
                flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                'Xác thực & Đăng ký'
              )}
            </button>

            {/* Resend */}
            <div className="text-center">
              <span className="text-sm text-gray-500">Không nhận được mã? </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0}
                className="text-sm font-medium text-[#0068FF] hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed transition-colors"
              >
                {countdown > 0 ? `Gửi lại (${countdown}s)` : 'Gửi lại'}
              </button>
            </div>
          </form>

          {/* Back to register */}
          <div className="mt-8 text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0068FF] transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại đăng ký
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
