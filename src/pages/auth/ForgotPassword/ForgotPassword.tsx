import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  MessageCircle,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { authServices } from '@/services/authServices';
import { getErrorMessage } from '@/utils/getErrorMessage';

// ─── Schemas ─────────────────────────────────────────────────────────────────
const step1Schema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
});

const step2Schema = z
  .object({
    otp: z
      .string()
      .min(1, 'Vui lòng nhập mã OTP')
      .length(6, 'Mã OTP phải có đúng 6 chữ số')
      .regex(/^\d{6}$/, 'Mã OTP chỉ gồm chữ số'),
    newPassword: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu mới')
      .min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

// ─── Component ────────────────────────────────────────────────────────────────
export default function ForgotPassword() {
  const [step, setStep] = useState<1 | 2>(1);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const step1Form = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const step2Form = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  const onStep1Submit = async (data: Step1Data) => {
    setIsLoading(true);
    try {
      await authServices.forgotPassword(data.email);
      setSubmittedEmail(data.email);
      setStep(2);
      toast.success('Mã OTP đã được gửi đến email của bạn.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const onStep2Submit = async (data: Step2Data) => {
    setIsLoading(true);
    try {
      await authServices.resetPassword(submittedEmail, data.otp, data.newPassword);
      toast.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.');
      navigate('/login');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full pl-10 pr-4 py-3 text-sm rounded-xl border outline-none transition-all
    focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
    ${hasError ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-400' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`;

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
            Đặt lại mật khẩu nhanh chóng và bảo mật qua email
          </p>

          {[
            { Icon: Mail, text: 'Nhận OTP qua email trong giây lát' },
            { Icon: KeyRound, text: 'Mã OTP hiệu lực trong 15 phút' },
            { Icon: ShieldCheck, text: 'Bảo mật tài khoản của bạn' },
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

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${step >= s ? 'bg-[#0068FF] text-white' : 'bg-gray-100 text-gray-400'}`}
                >
                  {s}
                </div>
                {s < 2 && (
                  <div
                    className={`w-10 h-0.5 transition-colors ${step > s ? 'bg-[#0068FF]' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            ))}
            <span className="ml-2 text-xs text-gray-400">
              {step === 1 ? 'Nhập email' : 'Đặt lại mật khẩu'}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              /* ─── STEP 1: Email ─── */
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-1">Quên mật khẩu?</h2>
                <p className="text-gray-500 text-sm mb-7">
                  Nhập email đăng ký, chúng tôi sẽ gửi mã OTP 6 chữ số.
                </p>

                <form
                  onSubmit={step1Form.handleSubmit(onStep1Submit)}
                  className="space-y-4"
                  noValidate
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                      <input
                        {...step1Form.register('email')}
                        type="email"
                        placeholder="example@gmail.com"
                        autoComplete="email"
                        className={inputClass(!!step1Form.formState.errors.email)}
                      />
                    </div>
                    <AnimatePresence>
                      {step1Form.formState.errors.email && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-red-500 text-xs mt-1.5 overflow-hidden"
                        >
                          {step1Form.formState.errors.email.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-[#0068FF] hover:bg-[#0052CC] active:bg-[#003D99]
                      disabled:opacity-60 disabled:cursor-not-allowed
                      text-white font-semibold text-sm rounded-xl
                      transition-all duration-200 shadow-[0_4px_16px_rgba(0,104,255,0.35)]
                      flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang gửi OTP...
                      </>
                    ) : (
                      'Gửi mã OTP'
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              /* ─── STEP 2: OTP + new password ─── */
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-1">Đặt lại mật khẩu</h2>
                <p className="text-gray-500 text-sm mb-7">
                  Nhập mã OTP đã gửi đến{' '}
                  <span className="font-medium text-gray-700">{submittedEmail}</span>
                </p>

                <form
                  onSubmit={step2Form.handleSubmit(onStep2Submit)}
                  className="space-y-4"
                  noValidate
                >
                  {/* OTP */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Mã OTP (6 chữ số)
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                      <input
                        {...step2Form.register('otp')}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        autoComplete="one-time-code"
                        className={`${inputClass(!!step2Form.formState.errors.otp)} text-center text-xl tracking-[0.5em] font-bold`}
                      />
                    </div>
                    <AnimatePresence>
                      {step2Form.formState.errors.otp && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-red-500 text-xs mt-1.5 overflow-hidden"
                        >
                          {step2Form.formState.errors.otp.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* New password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Mật khẩu mới
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                      <input
                        {...step2Form.register('newPassword')}
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Tối thiểu 6 ký tự"
                        autoComplete="new-password"
                        className={`${inputClass(!!step2Form.formState.errors.newPassword)} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((p) => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                        tabIndex={-1}
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-[18px] h-[18px]" />
                        ) : (
                          <Eye className="w-[18px] h-[18px]" />
                        )}
                      </button>
                    </div>
                    <AnimatePresence>
                      {step2Form.formState.errors.newPassword && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-red-500 text-xs mt-1.5 overflow-hidden"
                        >
                          {step2Form.formState.errors.newPassword.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
                      <input
                        {...step2Form.register('confirmPassword')}
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Nhập lại mật khẩu"
                        autoComplete="new-password"
                        className={`${inputClass(!!step2Form.formState.errors.confirmPassword)} pr-11`}
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
                    <AnimatePresence>
                      {step2Form.formState.errors.confirmPassword && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-red-500 text-xs mt-1.5 overflow-hidden"
                        >
                          {step2Form.formState.errors.confirmPassword.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-[#0068FF] hover:bg-[#0052CC] active:bg-[#003D99]
                      disabled:opacity-60 disabled:cursor-not-allowed
                      text-white font-semibold text-sm rounded-xl
                      transition-all duration-200 shadow-[0_4px_16px_rgba(0,104,255,0.35)]
                      flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      'Xác nhận đặt lại mật khẩu'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full py-2.5 text-sm text-gray-500 hover:text-[#0068FF] transition-colors font-medium"
                  >
                    Gửi lại OTP về email khác
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Back to login */}
          <div className="mt-7 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0068FF] transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại đăng nhập
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
