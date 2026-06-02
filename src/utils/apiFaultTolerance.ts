import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

interface FaultTolerantRequestConfig extends InternalAxiosRequestConfig {
  _faultRetryCount?: number;
  _skipClientRateLimit?: boolean;
}

const DEFAULT_DUPLICATE_WINDOW_MS = 800;
const DEFAULT_RETRY_DELAY_MS = 3000;
const DEFAULT_RETRY_ATTEMPTS = 1;

const recentRequests = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUploadEndpoint(url: string) {
  return url.includes('/api/uploads/presign') || url.includes('/api/uploads/finalize');
}

function stableStringify(value: unknown): string {
  if (!value || typeof value !== 'object') return String(value ?? '');
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${key}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function getRequestKey(config: InternalAxiosRequestConfig) {
  const method = (config.method ?? 'get').toUpperCase();
  const url = config.url ?? '';
  const params = config.params ? JSON.stringify(config.params) : '';
  const body = method === 'GET' || method === 'HEAD' ? '' : stableStringify(config.data).slice(0, 1000);
  return `${method}:${url}:${params}:${body}`;
}

function createClientRateLimitError(config: InternalAxiosRequestConfig) {
  const error = new Error('Client rate limit: duplicate request blocked') as Error & {
    config?: InternalAxiosRequestConfig;
    code?: string;
    isClientRateLimited?: boolean;
  };
  error.config = config;
  error.code = 'CLIENT_RATE_LIMITED';
  error.isClientRateLimited = true;
  return error;
}

function isRetryable(error: AxiosError) {
  const method = (error.config?.method ?? 'get').toUpperCase();
  const isSafeMethod = method === 'GET' || method === 'HEAD';
  if (!isSafeMethod) return false;

  const status = error.response?.status;
  const isNetworkOrTimeout = error.code === 'ECONNABORTED' || !error.response;
  const isServerError = typeof status === 'number' && status >= 500;

  return isNetworkOrTimeout || isServerError;
}

export function attachClientRateLimiter(instance: AxiosInstance, windowMs = DEFAULT_DUPLICATE_WINDOW_MS) {
  instance.interceptors.request.use((config) => {
    const requestConfig = config as FaultTolerantRequestConfig;
    if (requestConfig._skipClientRateLimit) return config;
    if (isUploadEndpoint(config.url ?? '')) return config;

    const key = getRequestKey(config);
    const now = Date.now();
    const lastCalledAt = recentRequests.get(key) ?? 0;

    if (now - lastCalledAt < windowMs) {
      return Promise.reject(createClientRateLimitError(config));
    }

    recentRequests.set(key, now);
    return config;
  });
}

export function attachRetry3s(
  instance: AxiosInstance,
  attempts = DEFAULT_RETRY_ATTEMPTS,
  delayMs = DEFAULT_RETRY_DELAY_MS
) {
  // Retry co kiem soat cho client:
  // - Chi retry GET/HEAD vi day la request doc du lieu.
  // - Khong retry POST/PUT/PATCH/DELETE de tranh tao duplicate message/upload/action.
  // - Chi retry khi loi mang, timeout, hoac server tra ve 5xx.
  // - Moi lan retry se cho 3000ms de tranh spam server khi he thong dang loi.
  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as FaultTolerantRequestConfig | undefined;
    if (!config || !isRetryable(error)) {
      return Promise.reject(error);
    }

    config._faultRetryCount = config._faultRetryCount ?? 0;
    if (config._faultRetryCount >= attempts) {
      return Promise.reject(error);
    }

    config._faultRetryCount += 1;
    config._skipClientRateLimit = true;
    await sleep(delayMs);
    return instance(config);
  });
}
