import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import type { AppStore } from '@/store';
import { setAuth, forceLogout, showSessionNotice } from '@/store/slices/authSlice';
import { attachClientRateLimiter, attachRetry3s } from './apiFaultTolerance';

// Extend Axios config để thêm flag `_retry`
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
}

// Khai báo biến lưu store (inject sau)
let appStore: AppStore | null = null;

// Hàm để inject store từ bên ngoài
export const setAppStore = (store: AppStore) => {
  appStore = store;
};

// Tạo Axios instance
const authorizedAxios = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 1000 * 60 * 10, // 10 phút
  withCredentials: true,
});

attachClientRateLimiter(authorizedAxios);

// Biến lưu promise refresh (để tránh gọi nhiều lần)
let refreshTokenPromise: Promise<unknown> | null = null;

// Hàng đợi request chờ refresh
let subscribers: ((ok: boolean) => void)[] = [];

// Khi refresh xong thì gọi toàn bộ request đang chờ
function onRefreshed(success: boolean) {
  subscribers.forEach((cb) => cb(success));
  subscribers = [];
}

function getErrorMessage(data: unknown) {
  const message = (data as { message?: unknown } | undefined)?.message;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string' ? message : '';
}

function isRefreshRequest(url?: string) {
  return Boolean(url?.includes('/api/auth/refresh'));
}

function isSessionInvalidatedMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('thiết bị khác') ||
    normalized.includes('đăng nhập ở thiết bị khác') ||
    normalized.includes('phiên đăng nhập đã hết hạn') ||
    normalized.includes('phiên đăng nhập không hợp lệ') ||
    normalized.includes('người dùng không tồn tại') ||
    normalized.includes('tài khoản đã bị khóa')
  );
}

function shouldTryRefresh(message: string) {
  if (!message) return true;

  const normalized = message.toLowerCase();
  return (
    normalized === 'unauthorized' ||
    normalized.includes('jwt expired') ||
    normalized.includes('token expired') ||
    normalized.includes('access token')
  );
}

function getSessionNotice(message: string) {
  return {
    reasonCode: message.toLowerCase().includes('bị khóa') ? 'account_locked' as const : 'session_expired' as const,
    message: message || 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.',
  };
}

// Request interceptor
authorizedAxios.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor
authorizedAxios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // ===== 401 Unauthorized =====
    if (error.response?.status === 401) {
      const errMsg = getErrorMessage(error.response?.data);

      // Một số request dùng để tự xác thực phiên sau login/page reload.
      // Nếu các request này 401 thì nghĩa là cookie chưa được lưu/gửi đúng,
      // gọi refresh tiếp sẽ chỉ tạo thêm request 401 và làm lỗi khó đọc hơn.
      if (originalRequest?._skipAuthRefresh) {
        appStore?.dispatch(forceLogout());
        return Promise.reject(error);
      }

      // Single session / locked account / invalid session: access token có thể còn hạn,
      // nhưng backend cố ý từ chối vì phiên đã bị vô hiệu. Không refresh trong case này.
      if (isSessionInvalidatedMessage(errMsg)) {
        appStore?.dispatch(showSessionNotice(getSessionNotice(errMsg)));
        appStore?.dispatch(forceLogout());
        return Promise.reject(error);
      }

      // Nếu gọi refresh API → logout
      if (isRefreshRequest(originalRequest?.url)) {
        appStore?.dispatch(forceLogout());
        return Promise.reject(error);
      }

      // Chỉ refresh khi lỗi 401 có khả năng do access token hết hạn/missing.
      // Các lỗi 401 nghiệp vụ khác không nên refresh vì refresh cũng không giải quyết được.
      if (!shouldTryRefresh(errMsg)) {
        return Promise.reject(error);
      }

      // Nếu đã retry rồi → logout
      if (originalRequest._retry) {
        appStore?.dispatch(forceLogout());
        return Promise.reject(error);
      }

      // Đánh dấu request đã retry
      originalRequest._retry = true;

      // Nếu chưa có refreshPromise → gọi refresh
      if (!refreshTokenPromise) {
        refreshTokenPromise = import('@/services/authServices')
          .then(({ authServices }) => authServices.refreshToken())
          .then((result) => {
            if (result.statusCode === 200 && result.data?.user) {
              appStore?.dispatch(
                setAuth({
                  user: result.data.user,
                  isLoggedIn: true,
                })
              );
              onRefreshed(true); // báo các request chờ retry
            } else {
              throw new Error('Refresh failed');
            }
          })
          .catch(() => {
            // Do NOT return Promise.reject here — nobody awaits refreshTokenPromise directly.
            // Callers are notified via onRefreshed(false) → subscribers queue.
            // Returning a rejection would create an unhandled promise rejection crash.
            appStore?.dispatch(forceLogout());
            onRefreshed(false);
          })
          .finally(() => {
            refreshTokenPromise = null;
          });
      }

      // Các request khác sẽ chờ refresh xong
      return new Promise((resolve, reject) => {
        subscribers.push((success) => {
          if (success) {
            resolve(authorizedAxios(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    // ===== 410 Gone (token expired hoàn toàn) =====
    if (error.response?.status === 410 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshTokenPromise) {
        refreshTokenPromise = Promise.resolve()
          .then(() => {
            throw new Error('Token expired completely');
          })
          .catch((refreshError) => {
            appStore?.dispatch(forceLogout());
            return Promise.reject(refreshError);
          })
          .finally(() => {
            refreshTokenPromise = null;
          });
      }

      return refreshTokenPromise.then(() => Promise.reject(error));
    }

    return Promise.reject(error);
  }
);

attachRetry3s(authorizedAxios);

export default authorizedAxios;
