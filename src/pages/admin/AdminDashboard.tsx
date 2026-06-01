import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSearch,
  Gauge,
  HeartPulse,
  Lock,
  LogOut,
  MessageSquareWarning,
  Monitor,
  RefreshCw,
  Search,
  Server,
  Shield,
  Smartphone,
  Sparkles,
  Unlock,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { aiServices, type IndexedRagDocument, type RagCitation } from '@/services/aiServices';
import { authServices } from '@/services/authServices';
import { chatServices, type ModeratedMessage, type ModerationStats } from '@/services/chatServices';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { logoutUser } from '@/store/slices';
import type { User } from '@/types/user.type';
import { UserRole } from '@/types/user.type';
import authorizedAxios from '@/utils/authorizedAxios';
import { getErrorMessage } from '@/utils/getErrorMessage';

export type AdminPageId = 'dashboard' | 'users' | 'moderation' | 'ai' | 'health';
type HealthStatus = 'checking' | 'healthy' | 'down';
type ModerationStatus = 'pending' | 'approved' | 'confirmed';

interface HealthItem {
  id: string;
  name: string;
  endpoint: string;
  group: 'Gateway' | 'Service';
  status: HealthStatus;
  latency?: number;
  message?: string;
}

interface DeviceItem {
  deviceId: string;
  deviceType: string;
  deviceName?: string;
  loginAt: string;
  isCurrent: boolean;
}

const TABS: Array<{ id: AdminPageId; label: string; path: string; icon: typeof Gauge }> = [
  { id: 'dashboard', label: 'Tổng quan', path: '/admin', icon: Gauge },
  { id: 'users', label: 'Người dùng', path: '/admin/users', icon: Users },
  { id: 'moderation', label: 'Kiểm duyệt', path: '/admin/moderation', icon: MessageSquareWarning },
  { id: 'ai', label: 'AI & RAG', path: '/admin/ai', icon: Bot },
  { id: 'health', label: 'Sức khỏe hệ thống', path: '/admin/health', icon: HeartPulse },
];

const HEALTH_TARGETS: Array<Omit<HealthItem, 'status' | 'latency' | 'message'>> = [
  { id: 'gateway', name: 'API Gateway', endpoint: '/api/health', group: 'Gateway' },
  { id: 'auth', name: 'Auth Service', endpoint: '/api/auth/health', group: 'Service' },
  { id: 'user', name: 'User Service', endpoint: '/api/users/health', group: 'Service' },
  { id: 'friend', name: 'Friend Service', endpoint: '/api/friends/health', group: 'Service' },
  { id: 'chat', name: 'Chat Service', endpoint: '/api/chat/health', group: 'Service' },
  { id: 'upload', name: 'Upload Service', endpoint: '/api/uploads/health', group: 'Service' },
  { id: 'ai', name: 'AI Service', endpoint: '/api/ai/health', group: 'Service' },
];

const DATA_STORES = [
  ['PostgreSQL', 'Tài khoản, hồ sơ và quan hệ bạn bè'],
  ['MongoDB', 'Cuộc trò chuyện và tin nhắn'],
  ['Redis', 'Session, OTP và cache'],
  ['Redpanda Kafka', 'Event bất đồng bộ giữa service'],
  ['Qdrant', 'Vector search và RAG'],
];

const EMPTY_MODERATION_STATS: ModerationStats = {
  pending: 0,
  approved: 0,
  confirmed: 0,
  total: 0,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Panel({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Gauge;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

function StatusPill({ status }: { status: HealthStatus }) {
  const style =
    status === 'healthy'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'down'
        ? 'bg-red-50 text-red-700'
        : 'bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${style}`}
    >
      {status === 'healthy' ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : status === 'down' ? (
        <XCircle className="h-3.5 w-3.5" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      )}
      {status === 'healthy' ? 'Hoạt động' : status === 'down' ? 'Không phản hồi' : 'Đang kiểm tra'}
    </span>
  );
}

function UserAvatar({ user }: { user: User }) {
  if (user.avatar) {
    return (
      <img src={user.avatar} alt={user.fullName} className="h-10 w-10 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
      {(user.fullName || user.email).slice(0, 2).toUpperCase()}
    </div>
  );
}

function DeviceModal({
  user,
  devices,
  loading,
  kicking,
  onClose,
  onKick,
}: {
  user: User;
  devices: DeviceItem[];
  loading: boolean;
  kicking: string | null;
  onClose: () => void;
  onKick: (deviceId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-slate-900">Thiết bị của {user.fullName || user.email}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Đăng xuất từ xa phiên đăng nhập không còn tin cậy.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          ) : devices.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Không có phiên đăng nhập đang hoạt động.
            </p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => {
                const Icon = device.deviceType === 'mobile' ? Smartphone : Monitor;
                return (
                  <div
                    key={device.deviceId}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {device.deviceName ||
                          (device.deviceType === 'mobile' ? 'Điện thoại' : 'Trình duyệt web')}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatDate(device.loginAt)}</p>
                    </div>
                    <button
                      onClick={() => onKick(device.deviceId)}
                      disabled={kicking === device.deviceId}
                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {kicking === device.deviceId ? 'Đang xử lý' : 'Đăng xuất'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard({ activeTab = 'dashboard' }: { activeTab?: AdminPageId }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deviceUser, setDeviceUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [kickingDevice, setKickingDevice] = useState<string | null>(null);
  const [healthItems, setHealthItems] = useState<HealthItem[]>(
    HEALTH_TARGETS.map((target) => ({ ...target, status: 'checking' }))
  );
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [moderationStatus, setModerationStatus] = useState<ModerationStatus>('pending');
  const [moderationItems, setModerationItems] = useState<ModeratedMessage[]>([]);
  const [moderationStats, setModerationStats] = useState<ModerationStats>(EMPTY_MODERATION_STATS);
  const [loadingModeration, setLoadingModeration] = useState(false);
  const [reviewingMessage, setReviewingMessage] = useState<string | null>(null);
  const [ragTitle, setRagTitle] = useState('');
  const [ragText, setRagText] = useState('');
  const [ragQuestion, setRagQuestion] = useState('BinChat có những tính năng AI nào?');
  const [ragAnswer, setRagAnswer] = useState('');
  const [ragCitations, setRagCitations] = useState<RagCitation[]>([]);
  const [ragAnswerCached, setRagAnswerCached] = useState(false);
  const [ragCollectionId, setRagCollectionId] = useState('admin-console');
  const [ragUseCollection, setRagUseCollection] = useState(true);
  const [ragFilterByCollection, setRagFilterByCollection] = useState(false);
  const [ragDocuments, setRagDocuments] = useState<IndexedRagDocument[]>([]);
  const [ragDocumentCount, setRagDocumentCount] = useState(0);
  const [ragChunkCount, setRagChunkCount] = useState(0);
  const [ragIndexMode, setRagIndexMode] = useState<'new' | 'append' | 'replace'>('new');
  const [ragSelectedDocumentId, setRagSelectedDocumentId] = useState('');
  const [expandedRagDocuments, setExpandedRagDocuments] = useState<string[]>([]);
  const [ragAskError, setRagAskError] = useState('');
  const [loadingRagDocuments, setLoadingRagDocuments] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      setUsers(await authServices.getAdminUsers());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    setHealthItems(HEALTH_TARGETS.map((target) => ({ ...target, status: 'checking' })));
    const results = await Promise.all(
      HEALTH_TARGETS.map(async (target): Promise<HealthItem> => {
        const startedAt = performance.now();
        try {
          await authorizedAxios.get(target.endpoint);
          return {
            ...target,
            status: 'healthy',
            latency: Math.round(performance.now() - startedAt),
            message: 'OK',
          };
        } catch (error) {
          return {
            ...target,
            status: 'down',
            latency: Math.round(performance.now() - startedAt),
            message: getErrorMessage(error) || 'Không thể kết nối',
          };
        }
      })
    );
    setHealthItems(results);
    setCheckingHealth(false);
  }, []);

  const loadModeration = useCallback(async () => {
    setLoadingModeration(true);
    try {
      setModerationItems(await chatServices.getModerationQueue(moderationStatus));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingModeration(false);
    }
  }, [moderationStatus]);

  const loadModerationStats = useCallback(async () => {
    try {
      setModerationStats(await chatServices.getModerationStats());
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, []);

  const loadRagDocuments = useCallback(async () => {
    const collectionId = ragCollectionId.trim();
    setLoadingRagDocuments(true);
    try {
      const result = await aiServices.listDocumentsGrouped(
        ragFilterByCollection ? collectionId || undefined : undefined
      );
      setRagDocuments(result.documents);
      setRagDocumentCount(result.totalDocuments);
      setRagChunkCount(result.totalChunks);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingRagDocuments(false);
    }
  }, [ragCollectionId, ragFilterByCollection]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadUsers();
      checkHealth();
      loadModerationStats();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'moderation') {
      loadModeration();
      loadModerationStats();
    } else if (activeTab === 'health') {
      checkHealth();
    }
  }, [activeTab, loadUsers, checkHealth, loadModeration, loadModerationStats]);

  useEffect(() => {
    if (activeTab !== 'moderation') return;
    const timer = window.setInterval(() => {
      loadModeration();
      loadModerationStats();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [activeTab, loadModeration, loadModerationStats]);

  useEffect(() => {
    if (activeTab === 'ai') loadRagDocuments();
  }, [activeTab, ragFilterByCollection]);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !keyword ||
        user.fullName?.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? user.isActive : !user.isActive);
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = users.filter((user) => user.isActive).length;
    return {
      users: users.length,
      active,
      blocked: users.length - active,
      admins: users.filter((user) => user.role === UserRole.ADMIN).length,
      healthy: healthItems.filter((item) => item.status === 'healthy').length,
    };
  }, [users, healthItems]);

  const selectedRagDocument = ragDocuments.find(
    (document) => document.documentId === ragSelectedDocumentId
  );

  const toggleUserStatus = async (user: User) => {
    if (user.role === UserRole.ADMIN) {
      toast.info('Tài khoản admin được bảo vệ. Không thể khóa hoặc mở khóa từ Admin Console.');
      return;
    }
    setActionLoading(`status-${user.id}`);
    try {
      await authServices.updateUserStatus(user.id, !user.isActive);
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, isActive: !item.isActive } : item))
      );
      toast.success(
        user.isActive ? 'Đã khóa tài khoản và thu hồi session' : 'Đã mở khóa tài khoản'
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const changeUserRole = async (user: User, role: UserRole) => {
    if (user.role === role) return;
    if (user.role === UserRole.ADMIN) {
      toast.info('Không thể hạ quyền admin khác trong mô hình peer-admin.');
      return;
    }
    setActionLoading(`role-${user.id}`);
    try {
      await authServices.updateUserRole(user.id, role);
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, role } : item))
      );
      toast.success(`Đã cập nhật role thành ${role}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setActionLoading(null);
    }
  };

  const openDevices = async (user: User) => {
    if (user.role === UserRole.ADMIN) {
      toast.info('Không thể quản lý phiên đăng nhập của admin khác từ Admin Console.');
      return;
    }
    setDeviceUser(user);
    setDevices([]);
    setLoadingDevices(true);
    try {
      setDevices(await authServices.getAdminUserDevices(user.id));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingDevices(false);
    }
  };

  const kickDevice = async (deviceId: string) => {
    if (!deviceUser) return;
    setKickingDevice(deviceId);
    try {
      await authServices.remoteLogoutAdminUserDevice(deviceUser.id, deviceId);
      setDevices((current) => current.filter((device) => device.deviceId !== deviceId));
      toast.success('Đã đăng xuất thiết bị từ xa');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setKickingDevice(null);
    }
  };

  const reviewModeration = async (messageId: string, action: 'approve' | 'confirm') => {
    setReviewingMessage(messageId);
    try {
      if (action === 'approve') await chatServices.approveModeratedMessage(messageId);
      else await chatServices.confirmModeratedMessage(messageId);
      setModerationItems((current) => current.filter((message) => message._id !== messageId));
      await loadModerationStats();
      toast.success(action === 'approve' ? 'Đã khôi phục tin nhắn' : 'Đã xác nhận ẩn tin nhắn');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReviewingMessage(null);
    }
  };

  const indexRagDocument = async () => {
    if (!ragText.trim()) return toast.info('Nhập nội dung tài liệu trước khi index');
    if (!ragCollectionId.trim()) return toast.info('Nhập mã collection trước khi index');
    if (ragIndexMode !== 'new' && !selectedRagDocument) {
      return toast.info('Chọn tài liệu cần cập nhật');
    }
    setAiLoading('index');
    try {
      const result = await aiServices.indexDocument(ragText, {
        collectionId: selectedRagDocument?.collectionId || ragCollectionId.trim(),
        title: selectedRagDocument?.title || ragTitle || 'Admin document',
        source: selectedRagDocument?.source || 'admin-console',
        documentId: selectedRagDocument?.documentId,
        mode: ragIndexMode === 'append' ? 'append' : 'replace',
      });
      toast.success(`Đã index ${result.chunksIndexed} chunk vào Qdrant`);
      setRagTitle('');
      setRagText('');
      setRagSelectedDocumentId('');
      setRagIndexMode('new');
      await loadRagDocuments();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAiLoading(null);
    }
  };

  const askRag = async () => {
    if (!ragQuestion.trim()) return;
    setAiLoading('ask');
    setRagAskError('');
    try {
      const result = await aiServices.ask(
        ragQuestion,
        ragUseCollection ? ragCollectionId.trim() : undefined
      );
      setRagAnswer(result.answer);
      setRagCitations(result.citations);
      setRagAnswerCached(result.cached);
    } catch (error) {
      setRagAskError(
        'AI chưa phản hồi kịp. Gateway sẽ chờ tối đa 30 giây; bạn có thể thử lại câu hỏi.'
      );
      toast.error(getErrorMessage(error));
    } finally {
      setAiLoading(null);
    }
  };

  const deleteRagDocumentChunk = async (id: string) => {
    setAiLoading(`delete-${id}`);
    try {
      await aiServices.deleteDocumentChunk(id);
      await loadRagDocuments();
      toast.success('Đã xóa đoạn nội dung và index lại tài liệu');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAiLoading(null);
    }
  };

  const deleteRagDocument = async (documentId: string) => {
    setAiLoading(`delete-document-${documentId}`);
    try {
      await aiServices.deleteDocument(documentId);
      await loadRagDocuments();
      toast.success('Đã xóa toàn bộ tài liệu khỏi Qdrant');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAiLoading(null);
    }
  };

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  const refreshCurrentPage = () => {
    if (activeTab === 'dashboard') {
      loadUsers();
      checkHealth();
      loadModerationStats();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'moderation') {
      loadModeration();
      loadModerationStats();
    } else if (activeTab === 'ai') {
      loadRagDocuments();
    } else {
      checkHealth();
    }
  };

  const activeLabel = TABS.find((tab) => tab.id === activeTab)?.label;

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-900">
      <aside className="border-b border-slate-200 bg-white px-4 py-4 md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-[272px] md:border-b-0 md:border-r md:px-4 md:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-slate-950">BinChat Admin</h1>
            <p className="text-xs text-slate-400">System operation console</p>
          </div>
        </div>
        <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
          {TABS.map(({ id, label, path, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(path)}
              className={`flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors md:min-w-0 ${
                activeTab === id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-4 hidden border-t border-slate-100 pt-4 md:absolute md:bottom-5 md:left-4 md:right-4 md:block">
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Trở về chat
          </button>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="min-w-0 p-4 md:ml-[272px] md:p-7">
        <div className="mx-auto max-w-[1500px]">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Administration
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">{activeLabel}</h2>
            </div>
            <button
              onClick={refreshCurrentPage}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Làm mới dữ liệu
            </button>
          </header>

          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Tài khoản"
                  value={formatNumber(stats.users)}
                  hint={`${stats.active} đang hoạt động, ${stats.blocked} bị khóa`}
                  icon={Users}
                  tone="bg-blue-50 text-blue-700"
                />
                <StatCard
                  label="Admin"
                  value={formatNumber(stats.admins)}
                  hint="Tài khoản có quyền vận hành hệ thống"
                  icon={Shield}
                  tone="bg-amber-50 text-amber-700"
                />
                <StatCard
                  label="Chờ duyệt"
                  value={formatNumber(moderationStats.pending)}
                  hint={`${moderationStats.total} tin nhắn đã được AI đưa vào luồng kiểm duyệt`}
                  icon={MessageSquareWarning}
                  tone="bg-rose-50 text-rose-700"
                />
                <StatCard
                  label="Service"
                  value={`${stats.healthy}/${healthItems.length}`}
                  hint="Số service đang phản hồi health check"
                  icon={HeartPulse}
                  tone="bg-emerald-50 text-emerald-700"
                />
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <Panel title="Trạng thái service" description="Kết quả mới nhất từ API Gateway.">
                  <div className="divide-y divide-slate-100">
                    {healthItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-5 py-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.endpoint}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusPill status={item.status} />
                          <span className="w-14 text-right text-xs text-slate-400">
                            {item.latency ? `${item.latency}ms` : '-'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel
                  title="Data layer"
                  description="Các kho dữ liệu đang được dùng trong hệ thống."
                >
                  <div className="grid gap-2 p-4 sm:grid-cols-2">
                    {DATA_STORES.map(([name, description]) => (
                      <div key={name} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-sm font-bold text-slate-800">{name}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <Panel
              title="Quản lý người dùng"
              description="Khóa tài khoản, cấp quyền admin và quản lý phiên đăng nhập."
            >
              <div className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                Admin là các tài khoản ngang quyền. Bạn có thể cấp admin cho user thường, nhưng
                không thể tự khóa, hạ quyền hoặc quản lý phiên của một admin khác.
              </div>
              <div className="grid gap-2 border-b border-slate-100 p-4 md:grid-cols-[1fr_150px_150px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm theo tên hoặc email"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)}
                  className="rounded-xl border border-slate-200 px-3 text-sm"
                >
                  <option value="all">Tất cả role</option>
                  <option value={UserRole.USER}>User</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="rounded-xl border border-slate-200 px-3 text-sm"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Hoạt động</option>
                  <option value="blocked">Bị khóa</option>
                </select>
              </div>
              {loadingUsers ? (
                <div className="flex justify-center py-16">
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Người dùng</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3">Ngày tạo</th>
                        <th className="px-4 py-3 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar user={user} />
                              <div>
                                <p className="font-bold text-slate-800">
                                  {user.fullName || 'Chưa đặt tên'}
                                  {currentUser?.id === user.id && (
                                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                                      Bạn
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-400">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative w-fit">
                              <select
                                value={user.role || UserRole.USER}
                                disabled={
                                  user.role === UserRole.ADMIN ||
                                  actionLoading === `role-${user.id}`
                                }
                                title={
                                  user.role === UserRole.ADMIN
                                    ? 'Admin được bảo vệ trong mô hình peer-admin'
                                    : 'Cấp quyền admin cho tài khoản'
                                }
                                onChange={(event) =>
                                  changeUserRole(user, event.target.value as UserRole)
                                }
                                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-bold outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                              >
                                <option value={UserRole.USER}>User</option>
                                <option value={UserRole.ADMIN}>Admin</option>
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                            >
                              {user.isActive ? 'Hoạt động' : 'Bị khóa'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {user.role === UserRole.ADMIN ? (
                                <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">
                                  <Shield className="mr-1 inline h-3.5 w-3.5" />
                                  Được bảo vệ
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => openDevices(user)}
                                    className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                                  >
                                    <Smartphone className="mr-1 inline h-3.5 w-3.5" />
                                    Thiết bị
                                  </button>
                                  <button
                                    onClick={() => toggleUserStatus(user)}
                                    disabled={actionLoading === `status-${user.id}`}
                                    className={`rounded-lg px-3 py-2 text-xs font-bold ${user.isActive ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                                  >
                                    {user.isActive ? (
                                      <Lock className="mr-1 inline h-3.5 w-3.5" />
                                    ) : (
                                      <Unlock className="mr-1 inline h-3.5 w-3.5" />
                                    )}
                                    {user.isActive ? 'Khóa' : 'Mở khóa'}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {activeTab === 'moderation' && (
            <Panel
              title="Hàng đợi kiểm duyệt"
              description="AI tự động ẩn tin nhắn nghi ngờ. Admin quyết định khôi phục hoặc giữ ẩn."
            >
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
                {(['pending', 'approved', 'confirmed'] as ModerationStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setModerationStatus(status)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${moderationStatus === status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {status === 'pending'
                      ? 'Chờ duyệt'
                      : status === 'approved'
                        ? 'Đã khôi phục'
                        : 'Đã xác nhận ẩn'}{' '}
                    ({moderationStats[status]})
                  </button>
                ))}
                <button
                  onClick={() => {
                    loadModeration();
                    loadModerationStats();
                  }}
                  className="ml-auto rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                  Tải lại
                </button>
              </div>
              {loadingModeration ? (
                <div className="flex justify-center py-16">
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                </div>
              ) : moderationItems.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <p className="text-sm font-bold text-slate-500">
                    Không có tin nhắn ở trạng thái này.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    Queue tự tải lại mỗi 10 giây khi bạn đang mở tab. Tin nhắn vi phạm mới sẽ xuất
                    hiện sau khi AI xử lý qua Kafka.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {moderationItems.map((message) => {
                    const flagged = Object.entries(message.moderationCategories || {})
                      .filter(([, value]) => value)
                      .map(([key]) => key);
                    return (
                      <div
                        key={message._id}
                        className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-center"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                              {message.moderationStatus}
                            </span>
                            {message.moderationSeverity && (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase text-amber-700">
                                {message.moderationSeverity}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              {formatDate(message.moderatedAt || message.updatedAt)}
                            </span>
                          </div>
                          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                            {message.content || '[Tin nhắn không có nội dung chữ]'}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            Lý do:{' '}
                            {message.moderationReason ||
                              flagged.join(', ') ||
                              'OpenAI moderation model'}{' '}
                            · Sender: {message.senderId}
                          </p>
                        </div>
                        {message.moderationStatus === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => reviewModeration(message._id, 'approve')}
                              disabled={reviewingMessage === message._id}
                              className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                            >
                              Khôi phục
                            </button>
                            <button
                              onClick={() => reviewModeration(message._id, 'confirm')}
                              disabled={reviewingMessage === message._id}
                              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                            >
                              Xác nhận ẩn
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <Panel
                  title="Quản lý tài liệu RAG"
                  description="Tài liệu là hồ sơ gốc. Mỗi tài liệu được hệ thống tự chia thành nhiều chunk để tìm kiếm."
                >
                  <div className="space-y-3 p-4">
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
                      {(
                        [
                          ['new', 'Tạo mới'],
                          ['append', 'Nối thêm'],
                          ['replace', 'Thay nội dung'],
                        ] as const
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setRagIndexMode(mode);
                            setRagSelectedDocumentId('');
                          }}
                          className={`rounded-lg px-2 py-2 text-xs font-bold ${ragIndexMode === mode ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {ragIndexMode !== 'new' && (
                      <select
                        value={ragSelectedDocumentId}
                        onChange={(event) => setRagSelectedDocumentId(event.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                      >
                        <option value="">Chọn tài liệu hiện có</option>
                        {ragDocuments
                          .filter((document) => !document.legacy)
                          .map((document) => (
                            <option key={document.documentId} value={document.documentId}>
                              {document.title} ({document.chunkCount} chunk)
                            </option>
                          ))}
                      </select>
                    )}
                    <input
                      value={selectedRagDocument?.collectionId || ragCollectionId}
                      onChange={(event) => setRagCollectionId(event.target.value)}
                      disabled={ragIndexMode !== 'new'}
                      placeholder="Mã collection, ví dụ admin-console"
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500 focus:border-blue-500"
                    />
                    <input
                      value={selectedRagDocument?.title || ragTitle}
                      onChange={(event) => setRagTitle(event.target.value)}
                      disabled={ragIndexMode !== 'new'}
                      placeholder="Tiêu đề tài liệu"
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-500 focus:border-blue-500"
                    />
                    <textarea
                      value={ragText}
                      onChange={(event) => setRagText(event.target.value)}
                      rows={7}
                      placeholder={
                        ragIndexMode === 'append'
                          ? 'Nhập phần nội dung bổ sung. Hệ thống sẽ nối vào tài liệu đã chọn.'
                          : 'Nhập toàn bộ nội dung tài liệu'
                      }
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <p className="text-xs leading-relaxed text-slate-400">
                      {ragIndexMode === 'append'
                        ? 'Nối thêm giữ nội dung cũ và tạo lại bộ chunk nhất quán.'
                        : ragIndexMode === 'replace'
                          ? 'Thay nội dung sẽ xóa version chunk cũ của tài liệu đã chọn.'
                          : 'Tạo mới dùng collection và tiêu đề để sinh mã tài liệu ổn định.'}
                    </p>
                    <button
                      onClick={indexRagDocument}
                      disabled={aiLoading === 'index'}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <FileSearch className="h-4 w-4" />
                      {aiLoading === 'index'
                        ? 'Đang xử lý...'
                        : ragIndexMode === 'append'
                          ? 'Nối nội dung'
                          : ragIndexMode === 'replace'
                            ? 'Thay nội dung'
                            : 'Tạo tài liệu'}
                    </button>
                  </div>
                </Panel>
                <Panel
                  title="Test RAG bot"
                  description="Mặc định hỏi đúng collection quản trị. Một lượt chưa cache có thể cần vài giây để truy xuất và tạo câu trả lời."
                >
                  <div className="space-y-3 p-4">
                    <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={ragUseCollection}
                        onChange={(event) => setRagUseCollection(event.target.checked)}
                      />
                      Chỉ dùng collection `{ragCollectionId || 'chưa nhập'}`
                    </label>
                    <textarea
                      value={ragQuestion}
                      onChange={(event) => setRagQuestion(event.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={askRag}
                      disabled={
                        aiLoading === 'ask' || (ragUseCollection && !ragCollectionId.trim())
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      {aiLoading === 'ask' ? 'Đang truy xuất và tạo câu trả lời...' : 'Hỏi chatbot'}
                    </button>
                    {ragAskError && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                        <p className="font-bold">AI tạm thời chưa trả lời được</p>
                        <p className="mt-1">{ragAskError}</p>
                        <button
                          onClick={askRag}
                          className="mt-2 rounded-lg bg-amber-100 px-3 py-2 font-bold hover:bg-amber-200"
                        >
                          Thử lại câu hỏi
                        </button>
                      </div>
                    )}
                    {ragAnswer && (
                      <div className="space-y-3 rounded-xl bg-blue-50 p-3 text-sm leading-relaxed text-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-blue-700">
                            Câu trả lời có kiểm chứng nguồn
                          </span>
                          {ragAnswerCached && (
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-blue-600">
                              CACHE
                            </span>
                          )}
                        </div>
                        <p>{ragAnswer}</p>
                        {ragCitations.length > 0 && (
                          <div className="space-y-2 border-t border-blue-100 pt-3">
                            {ragCitations.map((citation, index) => (
                              <div key={citation.id} className="rounded-lg bg-white p-2 text-xs">
                                <p className="font-bold text-slate-700">
                                  [{index + 1}] {citation.title} · chunk {citation.chunkIndex + 1}
                                </p>
                                <p className="mt-1 text-slate-500">
                                  {citation.collectionId || 'global'} · rerank{' '}
                                  {citation.score.toFixed(3)} · vector{' '}
                                  {citation.vectorScore.toFixed(3)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Panel>
              </div>
              <Panel
                title="Kho tài liệu RAG"
                description="Danh sách được gom theo tài liệu. Mở một tài liệu để xem các chunk do hệ thống sinh tự động."
                action={
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                      {ragDocumentCount} tài liệu · {ragChunkCount} chunk
                    </span>
                    <button
                      onClick={() => setRagFilterByCollection((value) => !value)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                      {ragFilterByCollection
                        ? `Đang lọc: ${ragCollectionId || 'chưa nhập'}`
                        : 'Đang xem: tất cả'}
                    </button>
                    <button
                      onClick={() => loadRagDocuments()}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                      Tải lại
                    </button>
                  </div>
                }
              >
                {loadingRagDocuments && ragDocuments.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                ) : ragDocuments.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">
                    Chưa có tài liệu nào trong phạm vi đang xem.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {ragDocuments.map((document) => {
                      const expanded = expandedRagDocuments.includes(document.documentId);
                      return (
                        <div key={document.documentId} className="px-5 py-4">
                          <div className="flex flex-wrap items-start gap-3">
                            <button
                              onClick={() =>
                                setExpandedRagDocuments((current) =>
                                  current.includes(document.documentId)
                                    ? current.filter((id) => id !== document.documentId)
                                    : [...current, document.documentId]
                                )
                              }
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="text-sm font-bold text-slate-800">
                                {document.title}{' '}
                                <span className="ml-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">
                                  {document.chunkCount} chunk
                                </span>
                              </p>
                              <p className="mt-2 text-[11px] font-bold text-blue-600">
                                {document.collectionId || 'global'} · {document.documentId}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {expanded ? 'Ẩn danh sách chunk' : 'Mở để xem danh sách chunk'}
                              </p>
                            </button>
                            <div className="flex flex-wrap gap-2">
                              {!document.legacy && (
                                <>
                                  <button
                                    onClick={() => {
                                      setRagIndexMode('append');
                                      setRagSelectedDocumentId(document.documentId);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                                  >
                                    Nối thêm
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRagIndexMode('replace');
                                      setRagSelectedDocumentId(document.documentId);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
                                  >
                                    Thay nội dung
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => deleteRagDocument(document.documentId)}
                                disabled={aiLoading === `delete-document-${document.documentId}`}
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                Xóa tài liệu
                              </button>
                            </div>
                          </div>
                          {expanded && (
                            <div className="mt-4 space-y-2 border-l-2 border-blue-100 pl-3">
                              {document.chunks.map((chunk) => (
                                <div
                                  key={chunk.id}
                                  className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-600">
                                      Chunk {chunk.chunkIndex + 1}
                                    </p>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                      {chunk.preview}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => deleteRagDocumentChunk(chunk.id)}
                                    disabled={aiLoading === `delete-${chunk.id}`}
                                    className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                              Xóa đoạn
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-5">
              <Panel
                title="Health check service"
                description="Gọi trực tiếp health endpoint qua API Gateway."
                action={
                  <button
                    onClick={checkHealth}
                    disabled={checkingHealth}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`mr-1 inline h-3.5 w-3.5 ${checkingHealth ? 'animate-spin' : ''}`}
                    />
                    Kiểm tra lại
                  </button>
                }
              >
                <div className="divide-y divide-slate-100">
                  {healthItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-2 px-5 py-3 md:grid-cols-[1fr_120px_150px_1fr] md:items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          {item.group === 'Gateway' ? (
                            <Server className="h-4 w-4" />
                          ) : (
                            <Activity className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.endpoint}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">{item.group}</span>
                      <StatusPill status={item.status} />
                      <span className="text-xs text-slate-400">
                        {item.latency ? `${item.latency}ms` : '-'} · {item.message}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel
                title="Kiến trúc data layer"
                description="Danh sách thành phần hạ tầng. Đây là thông tin kiến trúc, không phải health check trực tiếp."
              >
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
                  {DATA_STORES.map(([name, description]) => (
                    <div key={name} className="rounded-xl bg-slate-50 p-3">
                      <Database className="h-4 w-4 text-blue-600" />
                      <p className="mt-2 text-sm font-bold text-slate-800">{name}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </div>
      </main>
      {deviceUser && (
        <DeviceModal
          user={deviceUser}
          devices={devices}
          loading={loadingDevices}
          kicking={kickingDevice}
          onClose={() => setDeviceUser(null)}
          onKick={kickDevice}
        />
      )}
    </div>
  );
}
