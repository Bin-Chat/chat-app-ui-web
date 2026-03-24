import publicAxios from '@/utils/publicAxios';
import authorizedAxios from '@/utils/authorizedAxios';
import type { User } from '@/types/user.type';
import { UserRole } from '@/types/user.type';

interface LoginPayload {
  email: string;
  password: string;
  deviceId?: string;
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
    publicAxios.post<AuthResponse>('/api/auth/login', data).then((r) => r.data),

  register: (data: RegisterPayload) =>
    publicAxios
      .post<{ message: string }>('/api/auth/register', data)
      .then((r) => r.data),

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
    publicAxios.get<User>('/api/auth/profile').then((r) => ({
      data: { user: r.data },
      statusCode: r.status,
    })),

  refreshToken: () =>
    publicAxios.post<AuthResponse>('/api/auth/refresh').then((r) => ({
      statusCode: r.status,
      data: r.data,
    })),

  // ─── Admin ────────────────────────────────────────────────────────────────

  getAdminUsers: () =>
    authorizedAxios.get<User[]>('/api/auth/admin/users').then((r) => r.data),

  updateUserStatus: (id: string, isActive: boolean) =>
    authorizedAxios
      .patch<{ message: string }>(`/api/auth/admin/users/${id}/status`, { isActive })
      .then((r) => r.data),

  updateUserRole: (id: string, role: UserRole) =>
    authorizedAxios
      .patch<{ message: string }>(`/api/auth/admin/users/${id}/role`, { role })
      .then((r) => r.data),
};
