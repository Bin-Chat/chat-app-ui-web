import { useState, useMemo, useEffect } from 'react';
import { Search, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

import { useAppSelector } from '@/hooks/useRedux';
import { appSocket } from '@/services/appSocket';
import UserAvatar from '@/components/UserAvatar';
import CreateGroupModal from './CreateGroupModal';
import type { Conversation } from '@/types/chat.type';

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({ activeId, onSelect }: ConversationListProps) {
  const conversations = useAppSelector((s) => s.chat.conversations);
  const loadingConversations = useAppSelector((s) => s.chat.loadingConversations);
  const currentUser = useAppSelector((s) => s.auth.user);
  const friends = useAppSelector((s) => s.friend.friends);
  const unreadCounts = useAppSelector((s) => s.chat.unreadCounts);
  const userPresence = useAppSelector((s) => s.chat.userPresence);
  const [search, setSearch] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Request presence for all direct chat partners
  useEffect(() => {
    const userIds = conversations
      .filter((c) => c.type === 'direct')
      .map((c) => c.participants.find((p) => p.userId !== currentUser?.id)?.userId)
      .filter(Boolean) as string[];
    if (userIds.length > 0) {
      appSocket.emit('presence:check', { userIds });
    }
  }, [conversations, currentUser?.id]);

  // Enrich conversations with other user info for direct chats
  const enriched = useMemo(() => {
    return conversations.map((conv) => {
      if (conv.type === 'direct') {
        const otherParticipant = conv.participants.find((p) => p.userId !== currentUser?.id);
        const friendItem = friends.find((f) => f.user.id === otherParticipant?.userId);
        return { ...conv, otherUser: friendItem?.user };
      }
      return conv;
    });
  }, [conversations, currentUser, friends]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched;
    const q = search.toLowerCase();
    return enriched.filter((c) => {
      const name = c.type === 'direct' ? c.otherUser?.fullName : c.name;
      return name?.toLowerCase().includes(q);
    });
  }, [enriched, search]);

  const getDisplayName = (conv: Conversation & { otherUser?: any }) => {
    if (conv.type === 'direct') return conv.otherUser?.fullName || 'Người dùng';
    return conv.name || 'Nhóm chat';
  };

  const getAvatar = (conv: Conversation & { otherUser?: any }) => {
    if (conv.type === 'direct') return conv.otherUser?.avatar;
    return conv.avatar;
  };

  const getTimeLabel = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: vi });
    } catch {
      return '';
    }
  };

  return (
    <>
      <aside className="w-[320px] h-full bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[17px] font-bold text-gray-800">Tin nhắn</h2>
            <button
              onClick={() => setShowCreateGroup(true)}
              title="Tạo nhóm mới"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-[#0068FF] transition-colors"
            >
              <Users className="w-4.5 h-4.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm hội thoại..."
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-[#0068FF]/40 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {loadingConversations && conversations.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#0068FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400 mt-8">
              {search ? 'Không tìm thấy hội thoại' : 'Chưa có hội thoại nào'}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((conv) => {
                const isActive = activeId === conv._id;
                const displayName = getDisplayName(conv);
                const avatar = getAvatar(conv);
                const lastMsg = conv.lastMessage;
                const unread = unreadCounts[conv._id] ?? 0;

                return (
                  <li
                    key={conv._id}
                    onClick={() => onSelect(conv._id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
                    ${isActive ? 'bg-[#EBF3FF]' : 'hover:bg-gray-50'}`}
                  >
                    <UserAvatar
                      src={avatar}
                      name={displayName}
                      size={44}
                      online={
                        conv.type === 'direct'
                          ? userPresence[
                              conv.participants.find((p) => p.userId !== currentUser?.id)?.userId ??
                                ''
                            ]?.online
                          : undefined
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-[13px] truncate ${unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}
                        >
                          {displayName}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {lastMsg && (
                            <span className="text-[11px] text-gray-400">
                              {getTimeLabel(lastMsg.sentAt)}
                            </span>
                          )}
                          {unread > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#0068FF] text-white text-[11px] font-bold flex items-center justify-center leading-none">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                      {lastMsg && (
                        <p
                          className={`text-[12px] truncate mt-0.5 ${unread > 0 ? 'font-semibold text-gray-600' : 'text-gray-400'}`}
                        >
                          {lastMsg.revokedAt
                            ? <span className="italic">Tin nhắn đã thu hồi</span>
                            : (lastMsg.content || '[Tệp đính kèm]')}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </>
  );
}
