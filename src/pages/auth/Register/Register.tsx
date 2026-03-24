import { useState } from 'react';
import type { ReactNode } from 'react';
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
  User,
  MessageCircle,
  ArrowLeft,
  Gift,
  Smartphone,
  Users,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { authServices } from '@/services/authServices';
import { getErrorMessage } from '@/utils/getErrorMessage';

// ─── Schema validation ───────────────────────────────────────────────────────
const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(1, 'Vui lòng nhập họ tên')
      .min(2, 'Họ tên tối thiểu 2 ký tự')
      .max(60, 'Họ tên tối đa 60 ký tự'),
    email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
    password: z.string().min(1, 'Vui lòng nhập mật khẩu').min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

// ─── Password strength indicator ─────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    password.length >= 6,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['Yếu', 'Trung bình', 'Khá', 'Mạnh'];
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score - 1] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400">
        Độ mạnh:{' '}
        <span
          className={`font-medium ${score <= 1 ? 'text-red-500' : score <= 2 ? 'text-orange-500' : score <= 3 ? 'text-yellow-600' : 'text-green-600'}`}
        >
          {labels[Math.max(score - 1, 0)]}
        </span>
      </p>
    </div>
  );
}

// ─── Form field component ─────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  index?: number;
}

function Field({ label, error, children, index = 0 }: FieldProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08, duration: 0.35 }}
    >
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-red-500 text-xs mt-1.5 overflow-hidden"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const passwordValue = watch('password', '');

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const deviceId = localStorage.getItem('deviceId') || undefined;
      await authServices.register({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        deviceId,
      });
      toast.info('Mã xác thực đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.');
      navigate('/verify-email', { state: { email: data.email } });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full pl-10 pr-4 py-3 text-sm rounded-xl border outline-none transition-all
    focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
    ${
      hasError
        ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-400'
        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
    }`;

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
            Tham gia hàng triệu người dùng — tạo tài khoản chỉ mất 30 giây
          </p>

          {[
            { Icon: Gift, text: 'Miễn phí hoàn toàn, mãi mãi' },
            { Icon: Smartphone, text: 'Đồng bộ mọi thiết bị của bạn' },
            { Icon: Users, text: 'Kết nối bạn bè & gia đình' },
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
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-10 overflow-y-auto">
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
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Tạo tài khoản</h2>
          <p className="text-gray-500 text-sm mb-7">Chỉ mất vài giây — hoàn toàn miễn phí!</p>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Full name */}
            <Field label="Họ và tên" error={errors.fullName?.message} index={0}>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                <input
                  {...register('fullName')}
                  type="text"
                  placeholder="Nguyễn Văn A"
                  autoComplete="name"
                  className={inputClass(!!errors.fullName)}
                />
              </div>
            </Field>

            {/* Email */}
            <Field label="Email" error={errors.email?.message} index={1}>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="example@gmail.com"
                  autoComplete="email"
                  className={inputClass(!!errors.email)}
                />
              </div>
            </Field>

            {/* Password */}
            <Field label="Mật khẩu" error={errors.password?.message} index={2}>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                  className={`${inputClass(!!errors.password)} pr-11`}
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
              <PasswordStrength password={passwordValue} />
            </Field>

            {/* Confirm password */}
            <Field label="Xác nhận mật khẩu" error={errors.confirmPassword?.message} index={3}>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                  className={`${inputClass(!!errors.confirmPassword)} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
            </Field>

            {/* Terms */}
            <p className="text-xs text-gray-400 text-center leading-relaxed pt-1">
              Bằng cách đăng ký, bạn đồng ý với{' '}
              <button type="button" className="text-[#0068FF] hover:underline font-medium">
                Điều khoản dịch vụ
              </button>{' '}
              và{' '}
              <button type="button" className="text-[#0068FF] hover:underline font-medium">
                Chính sách bảo mật
              </button>
            </p>

            {/* Submit */}
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
                  Đang tạo tài khoản...
                </>
              ) : (
                'Tạo tài khoản'
              )}
            </button>
          </form>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0068FF] transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Đã có tài khoản? Đăng nhập
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
