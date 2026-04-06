import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { fetchMessages, fetchGroupMemberProfiles } from '@/store/slices';
import { appSocket } from '@/services/appSocket';
import UserAvatar from '@/components/UserAvatar';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ForwardModal from './ForwardModal';
import GroupInfoPanel from './GroupInfoPanel';
import type { Message } from '@/types/chat.type';

interface ChatRoomProps {
  conversationId: string;
}

export default function ChatRoom({ conversationId }: ChatRoomProps) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector((s) => s.chat.messages[conversationId] ?? []);
  const hasMore = useAppSelector((s) => s.chat.hasMore[conversationId] ?? true);
  const loadingMessages = useAppSelector((s) => s.chat.loadingMessages);
  const conversations = useAppSelector((s) => s.chat.conversations);
  const currentUser = useAppSelector((s) => s.auth.user);
  const friends = useAppSelector((s) => s.friend.friends);
  const groupMemberProfiles = useAppSelector((s) => s.chat.groupMemberProfiles);
  const userPresence = useAppSelector((s) => s.chat.userPresence);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Global hover tracking — only one message shows its action bar at a time
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevMessagesLenRef = useRef(0);

  const conversation = conversations.find((c) => c._id === conversationId);

  // Derive other user info for direct chats
  const otherUser = useMemo(() => {
    if (!conversation || conversation.type !== 'direct') return null;
    const otherP = conversation.participants.find((p) => p.userId !== currentUser?.id);
    return friends.find((f) => f.user.id === otherP?.userId)?.user ?? null;
  }, [conversation, currentUser, friends]);

  const displayName =
    conversation?.type === 'direct'
      ? otherUser?.fullName || 'Người dùng'
      : conversation?.name || 'Nhóm chat';

  const avatarSrc = conversation?.type === 'direct' ? otherUser?.avatar : conversation?.avatar;

  // Load messages on mount / conversation change
  useEffect(() => {
    if (conversationId) {
      dispatch(fetchMessages({ conversationId }));
      prevMessagesLenRef.current = 0;
    }
  }, [conversationId, dispatch]);

  // Fetch group member profiles for non-friend participants
  useEffect(() => {
    if (conversation?.type === 'group') {
      const participantIds = conversation.participants
        .map((p) => p.userId)
        .filter((id) => id !== currentUser?.id);
      if (participantIds.length > 0) {
        dispatch(fetchGroupMemberProfiles(participantIds));
      }
    }
  }, [conversation?.type, conversation?.participants, currentUser?.id, dispatch]);

  // Request presence info for conversation participants
  useEffect(() => {
    if (!conversation) return;
    const userIds = conversation.participants
      .map((p) => p.userId)
      .filter((id) => id !== currentUser?.id);
    if (userIds.length > 0) {
      appSocket.emit('presence:check', { userIds });
    }
  }, [conversationId, conversation?.participants, currentUser?.id]);

  // Compute presence status text
  const presenceText = useMemo(() => {
    if (!conversation) return '';
    if (conversation.type === 'direct') {
      const otherP = conversation.participants.find((p) => p.userId !== currentUser?.id);
      if (!otherP) return '';
      const presence = userPresence[otherP.userId];
      if (!presence) return '';
      if (presence.online) return 'Đang hoạt động';
      if (presence.lastSeen) {
        return `Hoạt động ${formatDistanceToNow(new Date(presence.lastSeen), { addSuffix: true, locale: vi })}`;
      }
      return '';
    }
    // Group chat
    const onlineCount = conversation.participants.filter(
      (p) => p.userId !== currentUser?.id && userPresence[p.userId]?.online
    ).length;
    return `${conversation.participants.length} thành viên${onlineCount > 0 ? ` · ${onlineCount} đang hoạt động` : ''}`;
  }, [conversation, currentUser?.id, userPresence]);

  // Scroll to bottom when new messages arrive (not when loading older)
  useEffect(() => {
    if (messages.length > prevMessagesLenRef.current) {
      const added = messages.length - prevMessagesLenRef.current;
      // Only auto-scroll if a small number of new messages arrived (i.e., not a batch load)
      if (added <= 5) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView();
    }, 100);
    return () => clearTimeout(timer);
  }, [conversationId]);

  // Load more on scroll to top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || loadingMessages || !hasMore) return;
    if (container.scrollTop < 100) {
      const oldestMsg = messages[0]; // ASC storage: index 0 = oldest message
      if (oldestMsg) {
        dispatch(fetchMessages({ conversationId, cursor: oldestMsg.createdAt }));
      }
    }
  }, [conversationId, dispatch, hasMore, loadingMessages, messages]);

  // Filter out deleted messages for current user
  const visibleMessages = useMemo(() => {
    return messages.filter((m) => !(m.deletedFor ?? []).includes(currentUser?.id ?? ''));
  }, [messages, currentUser]);

  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = msgRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(messageId);
      setTimeout(() => setHighlightedId(null), 2000);
    }
  }, []);

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0 bg-[#F0F2F5]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <UserAvatar
            src={avatarSrc}
            name={displayName}
            size={40}
            online={
              conversation?.type === 'direct'
                ? userPresence[
                    conversation.participants.find((p) => p.userId !== currentUser?.id)?.userId ??
                      ''
                  ]?.online
                : undefined
            }
          />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-gray-800 truncate">{displayName}</p>
            {presenceText && (
              <p
                className={`text-[12px] ${
                  conversation?.type === 'direct' &&
                  userPresence[
                    conversation.participants.find((p) => p.userId !== currentUser?.id)?.userId ??
                      ''
                  ]?.online
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                {presenceText}
              </p>
            )}
          </div>
          {conversation?.type === 'group' && (
            <button
              onClick={() => setShowGroupInfo((v) => !v)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                showGroupInfo ? 'bg-[#EBF3FF] text-[#0068FF]' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Info className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        >
          {loadingMessages && messages.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#0068FF] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {hasMore && messages.length > 0 && loadingMessages && (
            <div className="flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-[#0068FF] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {visibleMessages.map((msg, idx) => {
            // System messages (group events)
            if (msg.senderId === 'system') {
              return (
                <div key={msg._id} className="flex justify-center py-1">
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              );
            }

            const isMine = msg.senderId === currentUser?.id;
            const showAvatar =
              !isMine && (idx === 0 || visibleMessages[idx - 1].senderId !== msg.senderId);

            const senderFriend = !isMine
              ? friends.find((f) => f.user.id === msg.senderId)?.user
              : null;
            const senderProfile =
              !isMine && !senderFriend ? groupMemberProfiles[msg.senderId] : null;
            const senderName = senderFriend?.fullName ?? senderProfile?.fullName ?? null;
            const senderAvatar = senderFriend?.avatar ?? senderProfile?.avatar ?? null;

            // Show sender name in group chats
            const showSenderName = conversation?.type === 'group' && !isMine && showAvatar;

            return (
              <div key={msg._id}>
                {showSenderName && senderName && (
                  <p
                    className={`text-[11px] text-gray-500 font-medium mb-0.5 ${!showAvatar ? 'pl-11' : 'pl-[42px]'}`}
                  >
                    {senderName}
                  </p>
                )}
                <MessageBubble
                  key={msg._id}
                  message={msg}
                  isMine={isMine}
                  showAvatar={showAvatar}
                  senderName={senderName}
                  senderAvatar={senderAvatar}
                  conversationId={conversationId}
                  onForward={() => setForwardingMessageId(msg._id)}
                  onReply={(m) => setReplyingTo(m)}
                  onScrollToMessage={handleScrollToMessage}
                  isHighlighted={highlightedId === msg._id}
                  isHovered={hoveredMsgId === msg._id}
                  onHoverIn={() => setHoveredMsgId(msg._id)}
                  onHoverOut={() => setHoveredMsgId(null)}
                  bubbleRef={(el) => {
                    if (el) msgRefs.current.set(msg._id, el);
                    else msgRefs.current.delete(msg._id);
                  }}
                />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <MessageInput
          conversationId={conversationId}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />

        {/* Forward modal */}
        {forwardingMessageId && (
          <ForwardModal
            messageId={forwardingMessageId}
            onClose={() => setForwardingMessageId(null)}
          />
        )}
      </div>

      {/* Group info panel */}
      {showGroupInfo && conversation?.type === 'group' && (
        <GroupInfoPanel conversation={conversation} onClose={() => setShowGroupInfo(false)} />
      )}
    </div>
  );
}
