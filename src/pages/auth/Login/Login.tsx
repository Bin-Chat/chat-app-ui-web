import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { useAppDispatch } from '@/hooks/useRedux';
import { setAuth, fetchProfile } from '@/store/slices';
import { authServices } from '@/services/authServices';
import { getErrorMessage } from '@/utils/getErrorMessage';

// ─── Schema validation ───────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─── Component ────────────────────────────────────────────────────────────────
export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const deviceId = localStorage.getItem('deviceId') || undefined;
      const result = await authServices.login({
        email: data.email,
        password: data.password,
        deviceId,
      });
      dispatch(setAuth({ user: result.user, isLoggedIn: true }));
      dispatch(fetchProfile()); // refresh full profile data
      if (result.deviceId) localStorage.setItem('deviceId', result.deviceId);
      toast.success('Đăng nhập thành công!');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ─── LEFT: Bin Chat Blue Panel ─── */}
      <motion.div
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-[46%] bg-[#0068FF] flex-col items-center justify-center p-14 relative overflow-hidden select-none"
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-1/3 right-8 w-40 h-40 rounded-full bg-white/[0.04] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          {/* Logo */}
          <div className="w-20 h-20 bg-white rounded-[22px] flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.18)] mb-6">
            <MessageCircle className="w-12 h-12 text-[#0068FF]" strokeWidth={2.5} />
          </div>

          <h1 className="text-white text-5xl font-bold tracking-tight mb-3">Bin Chat</h1>
          <p className="text-white/75 text-base leading-relaxed max-w-[260px] mb-10">
            Nhắn tin, gọi điện qua Bin Chat — nhanh, tiện, tiết kiệm
          </p>

          {/* Feature list */}
          {[
            { Icon: MessageSquare, text: 'Nhắn tin và gọi video miễn phí' },
            { Icon: ShieldCheck, text: 'Bảo mật đầu cuối tuyệt đối' },
            { Icon: Zap, text: 'Tốc độ cao, ổn định mọi lúc' },
          ].map(({ Icon, text }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.12, duration: 0.4 }}
              className="flex items-center gap-3 w-full bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3.5 mb-3 text-white"
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
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Đăng nhập</h2>
          <p className="text-gray-500 text-sm mb-8">
            Chào mừng trở lại! Vui lòng đăng nhập để tiếp tục.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="example@gmail.com"
                  autoComplete="email"
                  className={`w-full pl-10 pr-4 py-3 text-sm rounded-xl border outline-none transition-all
                    focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
                    ${
                      errors.email
                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-400'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                />
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-red-500 text-xs mt-1.5 overflow-hidden"
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-11 py-3 text-sm rounded-xl border outline-none transition-all
                    focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
                    ${
                      errors.password
                        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-400'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-red-500 text-xs mt-1.5 overflow-hidden"
                  >
                    {errors.password.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-[#0068FF] hover:text-[#0052CC] font-medium transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>

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
                  Đang đăng nhập...
                </>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-7 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-gray-400 text-xs font-medium">hoặc</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Register link */}
          <p className="text-center text-sm text-gray-500">
            Chưa có tài khoản?{' '}
            <Link
              to="/register"
              className="text-[#0068FF] hover:text-[#0052CC] font-semibold transition-colors"
            >
              Đăng ký ngay
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
