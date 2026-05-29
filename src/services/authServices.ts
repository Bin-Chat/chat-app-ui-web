import publicAxios from '@/utils/publicAxios';
import authorizedAxios from '@/utils/authorizedAxios';
import type { User } from '@/types/user.type';
import { UserRole } from '@/types/user.type';

interface LoginPayload {
  email: string;
  password: string;
  deviceId?: string;
  deviceType?: 'mobile' | 'web';
  deviceName?: string;
}

interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  deviceId?: string;
}

interface AuthResponse {
  user: User;
  deviceId: string;
  message: string;
}

export const authServices = {
  login: (data: LoginPayload) =>
    publicAxios
      .post<AuthResponse>('/api/auth/login', {
        ...data,
        deviceType: data.deviceType ?? 'web',
        deviceName:
          (data.deviceName ?? navigator.userAgent.includes('Mobile'))
            ? 'Trình duyệt mobile'
            : 'Trình duyệt web',
      })
      .then((r) => r.data),

  register: (data: RegisterPayload) =>
    publicAxios.post<{ message: string }>('/api/auth/register', data).then((r) => r.data),

  verifyRegistration: (email: string, otp: string, deviceId?: string) =>
    publicAxios
      .post<AuthResponse>('/api/auth/verify-registration', { email, otp, deviceId })
      .then((r) => r.data),

  resendVerification: (email: string) =>
    publicAxios
      .post<{ message: string }>('/api/auth/resend-verification', { email })
      .then((r) => r.data),

  logout: () => publicAxios.post('/api/auth/logout').then((r) => r.data),

  forgotPassword: (email: string) =>
    publicAxios
      .post<{ message: string }>('/api/auth/forgot-password', { email })
      .then((r) => r.data),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    publicAxios
      .post<{ message: string }>('/api/auth/reset-password', { email, otp, newPassword })
      .then((r) => r.data),

  getProfile: () =>
    authorizedAxios.get<User>('/api/auth/profile').then((r) => ({
      data: { user: r.data },
      statusCode: r.status,
    })),

  refreshToken: () =>
    publicAxios.post<AuthResponse>('/api/auth/refresh').then((r) => ({
      statusCode: r.status,
      data: r.data,
    })),

  // ─── Admin ────────────────────────────────────────────────────────────────

  getAdminUsers: () => authorizedAxios.get<User[]>('/api/auth/admin/users').then((r) => r.data),

  updateUserStatus: (id: string, isActive: boolean) =>
    authorizedAxios
      .patch<{ message: string }>(`/api/auth/admin/users/${id}/status`, { isActive })
      .then((r) => r.data),

  updateUserRole: (id: string, role: UserRole) =>
    authorizedAxios
      .patch<{ message: string }>(`/api/auth/admin/users/${id}/role`, { role })
      .then((r) => r.data),

  // ── Profile ───────────────────────────────────────────────────────────────

  updateProfile: (
    id: string,
    data: { fullName?: string; avatar?: string; phone?: string; bio?: string }
  ) => authorizedAxios.patch<User>(`/api/users/${id}/profile`, data).then((r) => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    authorizedAxios
      .patch<{ message: string }>('/api/auth/change-password', data)
      .then((r) => r.data),

  // ── Device Management ─────────────────────────────────────────────────────

  getDevices: () =>
    authorizedAxios
      .get<
        {
          deviceId: string;
          deviceType: string;
          deviceName?: string;
          loginAt: string;
          isCurrent: boolean;
        }[]
      >('/api/auth/devices')
      .then((r) => r.data),

  remoteLogout: (deviceId: string) =>
    authorizedAxios
      .delete<{ message: string }>(`/api/auth/devices/${deviceId}`)
      .then((r) => r.data),

  // ── File Upload ───────────────────────────────────────────────────────────

  presignUpload: (data: {
    category: 'avatar' | 'image' | 'video' | 'document' | 'audio';
    filename: string;
    mimeType: string;
    fileSize: number;
  }) =>
    authorizedAxios
      .post<{ presignedUrl: string; objectKey: string }>('/api/uploads/presign', data)
      .then((r) => r.data),

  finalizeUpload: (data: { objectKey: string; category: string }) =>
    authorizedAxios
      .post<{
        objectKey: string;
        cdnUrl: string;
        size: number;
        contentType: string;
      }>('/api/uploads/finalize', data)
      .then((r) => r.data),
};
