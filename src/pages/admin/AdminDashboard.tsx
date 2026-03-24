import { useState, useEffect, useCallback } from 'react';
import { Shield, Users, Lock, Unlock, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';

import { authServices } from '@/services/authServices';
import { getErrorMessage } from '@/utils/getErrorMessage';
import type { User } from '@/types/user.type';
import { UserRole } from '@/types/user.type';

function RoleBadge({ role }: { role?: UserRole }) {
  if (role === UserRole.ADMIN) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        <Shield className="w-3 h-3" />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
      <Users className="w-3 h-3" />
      User
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
      }`}
    >
      {isActive ? 'Hoạt động' : 'Bị khóa'}
    </span>
  );
}

function Avatar({ fullName, avatar }: { fullName?: string; avatar?: string | null }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={fullName}
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  const initials = (fullName || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-[#0068FF]/10 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-[#0068FF]">{initials}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await authServices.getAdminUsers();
      setUsers(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleStatus = async (user: User) => {
    setActionLoading(`status-${user.id}`);
    try {
      await authServices.updateUserStatus(user.id, !user.isActive);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      );
      toast.success(!user.isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const changeRole = async (user: User, newRole: UserRole) => {
    if (user.role === newRole) return;
    setActionLoading(`role-${user.id}`);
    try {
      await authServices.updateUserRole(user.id, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
      toast.success(`Đã đổi role thành ${newRole}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#0068FF]/10 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#0068FF]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quản lý người dùng</h1>
            <p className="text-sm text-gray-500">{users.length} tài khoản</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#0068FF]/20 border-t-[#0068FF] rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">Chưa có người dùng nào</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Người dùng
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Role
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Trạng thái
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Ngày tạo
                    </th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* User info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar fullName={user.fullName} avatar={user.avatar} />
                          <div>
                            <p className="font-medium text-gray-900">{user.fullName || '—'}</p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        <div className="relative inline-block">
                          <select
                            value={user.role || UserRole.USER}
                            disabled={actionLoading === `role-${user.id}`}
                            onChange={(e) => changeRole(user, e.target.value as UserRole)}
                            className="appearance-none bg-transparent border-0 text-sm font-medium cursor-pointer focus:outline-none pr-5 disabled:opacity-50"
                          >
                            <option value={UserRole.USER}>User</option>
                            <option value={UserRole.ADMIN}>Admin</option>
                          </select>
                          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        </div>
                        <RoleBadge role={user.role} />
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge isActive={user.isActive} />
                      </td>

                      {/* Created at */}
                      <td className="px-5 py-4 text-gray-400 text-xs">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString('vi-VN')
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => toggleStatus(user)}
                          disabled={actionLoading === `status-${user.id}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed
                            ${
                              user.isActive
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                        >
                          {actionLoading === `status-${user.id}` ? (
                            <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                          ) : user.isActive ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              Khóa
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              Mở khóa
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
