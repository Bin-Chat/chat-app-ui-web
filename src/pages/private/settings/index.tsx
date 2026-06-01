import { useRef, useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Bell,
  Palette,
  ChevronRight,
  Monitor,
  Smartphone,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { updateProfile } from '@/store/slices';
import { authServices } from '@/services/authServices';
import UserAvatar from '@/components/UserAvatar';

// ─── Profile Form ─────────────────────────────────────────────────────────────
interface ProfileFormValues {
  fullName: string;
  avatar: string;
  phone: string;
  bio: string;
}

function ProfileSection() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const loading = useAppSelector((s) => s.auth.loading);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      fullName: user?.fullName ?? '',
      avatar: user?.avatar ?? '',
      phone: user?.phone ?? '',
      bio: user?.bio ?? '',
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatar ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      toast.error('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ảnh đại diện không được vượt quá 2 MB');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const { presignedUrl, objectKey } = await authServices.presignUpload({
        category: 'avatar',
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () =>
          xhr.status === 200 ? resolve() : reject(new Error(`S3 PUT failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error('Upload network error'));
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      const { cdnUrl } = await authServices.finalizeUpload({ objectKey, category: 'avatar' });
      setValue('avatar', cdnUrl);
      setAvatarPreview(cdnUrl);
      if (user) {
        await dispatch(updateProfile({ id: user.id, data: { avatar: cdnUrl } })).unwrap();
      }
      toast.success('Ảnh đại diện đã được cập nhật');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Tải ảnh lên thất bại');
      setAvatarPreview(user?.avatar ?? '');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) return;
    try {
      await dispatch(
        updateProfile({
          id: user.id,
          data: {
            fullName: values.fullName || undefined,
            avatar: values.avatar || undefined,
            phone: values.phone || undefined,
            bio: values.bio || undefined,
          },
        })
      ).unwrap();
      toast.success('Cập nhật thông tin thành công');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
    }
  };

  return (
    <div className="space-y-8">
      {/* Avatar hero */}
      <div className="flex flex-col items-center gap-3 py-6 border-b border-gray-100">
        <div className="relative">
          <UserAvatar src={avatarPreview} name={user?.fullName} size={88} variant="large" />
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
              <span className="text-white text-[12px] font-bold">{uploadProgress}%</span>
            </div>
          )}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#0068FF] rounded-full flex items-center
                       justify-center text-white shadow-md hover:bg-[#0057D9] transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-gray-900">{user?.fullName ?? '—'}</p>
          <p className="text-[12px] text-gray-400">{user?.email}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Form fields */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <input type="hidden" {...register('avatar')} />

        <div>
          <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Họ và tên
          </label>
          <input
            {...register('fullName', { required: 'Vui lòng nhập họ tên' })}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px]
                       focus:outline-none focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
                       transition-all bg-white"
            placeholder="Nguyễn Văn A"
          />
          {errors.fullName && (
            <p className="mt-1 text-[12px] text-red-500">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Số điện thoại
          </label>
          <input
            {...register('phone')}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px]
                       focus:outline-none focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
                       transition-all bg-white"
            placeholder="0901234567"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Giới thiệu
          </label>
          <textarea
            {...register('bio')}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px]
                       focus:outline-none focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
                       transition-all bg-white resize-none"
            placeholder="Một vài điều về bạn..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#0068FF] text-white text-[14px] font-medium rounded-xl
                     hover:bg-[#0057D9] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </form>
    </div>
  );
}

// ─── Security Section ─────────────────────────────────────────────────────────
interface SecurityFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function SecuritySection() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SecurityFormValues>();

  const onSubmit = async (values: SecurityFormValues) => {
    setSubmitting(true);
    try {
      await authServices.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Đổi mật khẩu thành công');
      reset();
    } catch (err: unknown) {
      const resp = (err as any)?.response?.data;
      const msg =
        (Array.isArray(resp?.message) ? resp.message[0] : resp?.message) ??
        resp?.error ??
        (err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Mật khẩu hiện tại
        </label>
        <div className="relative">
          <input
            {...register('currentPassword', { required: 'Vui lòng nhập mật khẩu hiện tại' })}
            type={showCurrent ? 'text' : 'password'}
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-[14px]
                       focus:outline-none focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
                       transition-all bg-white"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.currentPassword && (
          <p className="mt-1 text-[12px] text-red-500">{errors.currentPassword.message}</p>
        )}
      </div>

      <div>
        <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Mật khẩu mới
        </label>
        <div className="relative">
          <input
            {...register('newPassword', {
              required: 'Vui lòng nhập mật khẩu mới',
              minLength: { value: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
            })}
            type={showNew ? 'text' : 'password'}
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-[14px]
                       focus:outline-none focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
                       transition-all bg-white"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.newPassword && (
          <p className="mt-1 text-[12px] text-red-500">{errors.newPassword.message}</p>
        )}
      </div>

      <div>
        <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Xác nhận mật khẩu mới
        </label>
        <input
          {...register('confirmPassword', {
            required: 'Vui lòng xác nhận mật khẩu',
            validate: (v) => v === watch('newPassword') || 'Mật khẩu xác nhận không khớp',
          })}
          type="password"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px]
                     focus:outline-none focus:ring-2 focus:ring-[#0068FF]/30 focus:border-[#0068FF]
                     transition-all bg-white"
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-[12px] text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-[#0068FF] text-white text-[14px] font-medium rounded-xl
                   hover:bg-[#0057D9] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Đang đổi...' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
}

// ─── Placeholder sections ─────────────────────────────────────────────────────
function NotificationsSection() {
  return (
    <div className="space-y-3">
      {[
        { label: 'Thông báo lời mời kết bạn', defaultChecked: true },
        { label: 'Thông báo tin nhắn mới', defaultChecked: true },
        { label: 'Âm thanh thông báo', defaultChecked: false },
      ].map(({ label, defaultChecked }) => (
        <label
          key={label}
          className="flex items-center justify-between py-3 border-b border-gray-50 cursor-pointer group"
        >
          <span className="text-[14px] text-gray-800">{label}</span>
          <div className="relative">
            <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
            <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-[#0068FF] transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
          </div>
        </label>
      ))}
    </div>
  );
}

function AppearanceSection() {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-gray-500 mb-4">Chế độ giao diện</p>
      {(['Sáng', 'Tối', 'Theo hệ thống'] as const).map((mode) => (
        <label
          key={mode}
          className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer
                     hover:border-[#0068FF]/30 hover:bg-[#0068FF]/5 transition-colors"
        >
          <input
            type="radio"
            name="theme"
            className="accent-[#0068FF]"
            defaultChecked={mode === 'Sáng'}
          />
          <span className="text-[14px] text-gray-800">{mode}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Devices Section ──────────────────────────────────────────────────────────
interface DeviceItem {
  deviceId: string;
  deviceType: string;
  deviceName?: string;
  loginAt: string;
  isCurrent: boolean;
}

function DevicesSection() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kicking, setKicking] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authServices.getDevices();
      setDevices(data);
    } catch {
      toast.error('Không thể tải danh sách thiết bị');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleKick = async (deviceId: string) => {
    setKicking(deviceId);
    try {
      await authServices.remoteLogout(deviceId);
      toast.success('Đã đăng xuất thiết bị');
      loadDevices();
    } catch {
      toast.error('Không thể đăng xuất thiết bị');
    } finally {
      setKicking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Đang tải...</span>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-[13px]">
        Không có thiết bị nào đang đăng nhập.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-gray-400 mb-4">
        Các thiết bị đang có phiên đăng nhập hoạt động. Bạn có thể đăng xuất từ xa bất kỳ thiết bị
        nào.
      </p>
      {devices.map((device) => {
        const DeviceIcon = device.deviceType === 'mobile' ? Smartphone : Monitor;
        const loginDate = new Date(device.loginAt);
        const dateStr = loginDate.toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div
            key={device.deviceId}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border transition-colors',
              device.isCurrent
                ? 'border-[#0068FF]/30 bg-[#0068FF]/5'
                : 'border-gray-100 bg-white hover:border-gray-200'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                device.isCurrent ? 'bg-[#0068FF] text-white' : 'bg-gray-100 text-gray-500'
              )}
            >
              <DeviceIcon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-gray-800 truncate">
                  {device.deviceName ??
                    (device.deviceType === 'mobile' ? 'Điện thoại' : 'Trình duyệt web')}
                </p>
                {device.isCurrent && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0068FF] text-white font-medium flex-shrink-0">
                    Thiết bị này
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Đăng nhập lúc {dateStr}</p>
            </div>

            {!device.isCurrent && (
              <button
                onClick={() => handleKick(device.deviceId)}
                disabled={kicking === device.deviceId}
                title="Đăng xuất thiết bị này"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400
                           hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors flex-shrink-0"
              >
                {kicking === device.deviceId ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings Page — Telegram-style 2-column ──────────────────────────────────
type SectionId = 'profile' | 'security' | 'notifications' | 'appearance' | 'devices';

const NAV_ITEMS: { id: SectionId; label: string; subtitle: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Thông tin cá nhân', subtitle: 'Ảnh, tên, tiểu sử', icon: User },
  { id: 'security', label: 'Bảo mật', subtitle: 'Mật khẩu & đăng nhập', icon: Lock },
  { id: 'notifications', label: 'Thông báo', subtitle: 'Âm thanh & hiển thị', icon: Bell },
  { id: 'appearance', label: 'Giao diện', subtitle: 'Chủ đề & màu sắc', icon: Palette },
  { id: 'devices', label: 'Thiết bị', subtitle: 'Quản lý phiên đăng nhập', icon: Smartphone },
];

const SECTION_TITLES: Record<SectionId, string> = {
  profile: 'Thông tin cá nhân',
  security: 'Bảo mật',
  notifications: 'Thông báo',
  appearance: 'Giao diện',
  devices: 'Thiết bị đã đăng nhập',
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('profile');
  const user = useAppSelector((s) => s.auth.user);

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-[#F0F2F5]">
      {/* ── Left sidebar ── */}
      <div className="w-full md:w-[280px] flex-shrink-0 bg-white border-b md:border-b-0 md:border-r border-gray-100 flex flex-col max-h-[42vh] md:max-h-none">
        {/* Sidebar header */}
        <div className="px-4 sm:px-5 py-3 md:py-4 border-b border-gray-100">
          <h1 className="text-[16px] font-semibold text-gray-900">Cài đặt</h1>
        </div>

        {/* User identity card */}
        <div className="px-4 py-3 md:py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <UserAvatar src={user?.avatar} name={user?.fullName} size={44} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-gray-900 truncate">
                {user?.fullName ?? '—'}
              </p>
              <p className="text-[12px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 min-h-0 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto py-2 flex md:block">
          {NAV_ITEMS.map(({ id, label, subtitle, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                'min-w-[220px] md:min-w-0 md:w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group',
                activeSection === id
                  ? 'bg-[#0068FF]/8 text-[#0068FF]'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                  activeSection === id
                    ? 'bg-[#0068FF] text-white'
                    : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-[13px] font-medium truncate',
                    activeSection === id ? 'text-[#0068FF]' : 'text-gray-800'
                  )}
                >
                  {label}
                </p>
                <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
              </div>
              <ChevronRight
                className={cn(
                  'w-4 h-4 flex-shrink-0 transition-colors',
                  activeSection === id ? 'text-[#0068FF]' : 'text-gray-300'
                )}
              />
            </button>
          ))}
        </nav>
      </div>

      {/* ── Right content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 sm:px-6 md:px-8 py-5 md:py-8">
          {/* Section header */}
          <div className="mb-5 md:mb-7">
            <h2 className="text-[20px] font-semibold text-gray-900">
              {SECTION_TITLES[activeSection]}
            </h2>
            <div className="mt-1 w-8 h-0.5 bg-[#0068FF] rounded-full" />
          </div>

          {/* Section content */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            {activeSection === 'profile' && <ProfileSection />}
            {activeSection === 'security' && <SecuritySection />}
            {activeSection === 'notifications' && <NotificationsSection />}
            {activeSection === 'appearance' && <AppearanceSection />}
            {activeSection === 'devices' && <DevicesSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
