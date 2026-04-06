import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

import { useAppDispatch } from '@/hooks/useRedux';
import { sendFriendRequest, fetchSentRequests } from '@/store/slices';
import { friendServices } from '@/services/friendServices';
import type { User } from '@/types/user.type';

interface AddFriendPanelProps {
  onClose: () => void;
}

export default function AddFriendPanel({ onClose }: AddFriendPanelProps) {
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      // Try search by name first; if query looks like email, search by email
      let data: User[] = [];
      if (query.includes('@')) {
        try {
          const user = await friendServices.findUserByEmail(query.trim());
          data = user ? [user] : [];
        } catch {
          data = [];
        }
      } else {
        data = await friendServices.searchUsers(query.trim());
      }
      setResults(data);
      if (data.length === 0) toast.info('Không tìm thấy người dùng nào');
    } catch {
      toast.error('Tìm kiếm thất bại, thử lại sau');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (user: User) => {
    setSendingId(user.id);
    try {
      await dispatch(sendFriendRequest(user.id)).unwrap();
      setSentIds((prev) => new Set(prev).add(user.id));
      dispatch(fetchSentRequests());
      toast.success(`Đã gửi lời mời kết bạn tới ${user.fullName || user.email}`);
    } catch (err: any) {
      toast.error(err ?? 'Không thể gửi lời mời');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-[15px] font-semibold text-gray-800">Thêm bạn</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search input */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Tên hoặc địa chỉ email..."
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-gray-50 border border-gray-200
                         rounded-lg focus:outline-none focus:border-[#0068FF] focus:bg-white
                         transition-colors placeholder:text-gray-400"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || searching}
            className="px-4 py-2 text-[13px] font-medium bg-[#0068FF] text-white rounded-lg
                       hover:bg-[#0055d4] disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Tìm
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 select-none">
            <UserPlus className="w-10 h-10 mb-2 opacity-30" strokeWidth={1.2} />
            <p className="text-[13px]">Tìm kiếm để thêm bạn mới</p>
          </div>
        ) : (
          <ul className="p-2">
            {results.map((user) => {
              const isSent = sentIds.has(user.id);
              const isSending = sendingId === user.id;
              const letter = user.fullName?.charAt(0)?.toUpperCase() ?? 'U';

              return (
                <li
                  key={user.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#0068FF] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-sm font-bold">{letter}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">
                      {user.fullName || '(Chưa đặt tên)'}
                    </p>
                    <p className="text-[12px] text-gray-400 truncate">{user.email}</p>
                  </div>

                  {/* Action */}
                  {isSent ? (
                    <span className="text-[12px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                      Đã gửi
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(user)}
                      disabled={isSending}
                      className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium
                                 bg-[#EBF3FF] text-[#0068FF] rounded-full hover:bg-[#0068FF]
                                 hover:text-white transition-colors disabled:opacity-60"
                    >
                      {isSending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <UserPlus className="w-3 h-3" />
                      )}
                      Kết bạn
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
