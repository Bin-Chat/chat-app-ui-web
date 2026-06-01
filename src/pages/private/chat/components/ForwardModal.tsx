import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Search, CornerUpRight } from 'lucide-react';
import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { forwardMessage } from '@/store/slices';
import UserAvatar from '@/components/UserAvatar';

interface ForwardModalProps {
  messageId: string;
  onClose: () => void;
}

export default function ForwardModal({ messageId, onClose }: ForwardModalProps) {
  const dispatch = useAppDispatch();
  const conversations = useAppSelector((s) => s.chat.conversations);
  const friends = useAppSelector((s) => s.friend.friends);
  const currentUser = useAppSelector((s) => s.auth.user);
  const [search, setSearch] = useState('');
  const [forwarding, setForwarding] = useState(false);

  const enriched = useMemo(() => {
    return conversations.map((conv) => {
      if (conv.type === 'direct') {
        const otherP = conv.participants.find((p) => p.userId !== currentUser?.id);
        const friend = friends.find((f) => f.user.id === otherP?.userId);
        return {
          ...conv,
          displayName: friend?.user.fullName || 'Người dùng',
          avatar: friend?.user.avatar,
        };
      }
      return { ...conv, displayName: conv.name || 'Nhóm chat', avatar: conv.avatar };
    });
  }, [conversations, currentUser, friends]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched;
    const q = search.toLowerCase();
    return enriched.filter((c) => c.displayName?.toLowerCase().includes(q));
  }, [enriched, search]);

  const handleForward = async (targetConversationId: string) => {
    setForwarding(true);
    try {
      await dispatch(forwardMessage({ messageId, targetConversationId })).unwrap();
      toast.success('Đã chuyển tiếp tin nhắn');
      onClose();
    } catch (err: any) {
      toast.error(err ?? 'Không thể chuyển tiếp');
    } finally {
      setForwarding(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="pointer-events-auto w-[min(380px,calc(100vw-32px))] max-h-[500px] bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.14)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <CornerUpRight className="w-4 h-4 text-[#0068FF]" />
              <h3 className="text-[15px] font-semibold text-gray-800">Chuyển tiếp tin nhắn</h3>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm hội thoại..."
                className="w-full pl-9 pr-3 py-2 text-[13px] bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-[#0068FF]/40 focus:bg-white transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {filtered.length === 0 ? (
              <p className="text-center text-[13px] text-gray-400 py-8">Không tìm thấy</p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((conv) => (
                  <li key={conv._id}>
                    <button
                      onClick={() => handleForward(conv._id)}
                      disabled={forwarding}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <UserAvatar src={conv.avatar} name={conv.displayName} size={36} />
                      <span className="text-[13px] font-medium text-gray-800 truncate">
                        {conv.displayName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
