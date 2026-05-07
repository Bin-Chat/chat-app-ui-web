import { useEffect, useLayoutEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Info, Pin, ChevronDown, Ban, Phone, Video, Search, FileText, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import {
  fetchMessages,
  fetchGroupMemberProfiles,
  pinMessage,
  unpinMessage,
  fetchPinnedMessages,
  startCall,
  acceptCall,
} from '@/store/slices';
import { appSocket } from '@/services/appSocket';
import UserAvatar from '@/components/UserAvatar';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ForwardModal from './ForwardModal';
import GroupInfoPanel from './GroupInfoPanel';
import AiSearchPanel from './AiSearchPanel';
import AiSummaryModal from './AiSummaryModal';
import AiBotPanel from './AiBotPanel';
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
  const typingUsers = useAppSelector((s) => s.chat.typingUsers);
  const pinnedMessages = useAppSelector((s) => s.chat.pinnedMessages);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const loadingOlderRef = useRef(false);
  // Stable ref to the oldest visible message cursor — avoids messages/visibleMessages in handleScroll deps
  const oldestMsgCursorRef = useRef<string | null>(null);
  // Pending jump-to-message when target isn't rendered yet
  const pendingJumpRef = useRef<{ messageId: string; attempts: number } | null>(null);
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Global hover tracking — only one message shows its action bar at a time
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  // AI panels
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [showAiBot, setShowAiBot] = useState(false);
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
      dispatch(fetchPinnedMessages(conversationId));
      // Reset all pagination refs so previous conversation's state doesn't leak
      prevMessagesLenRef.current = 0;
      loadingOlderRef.current = false;
      prevScrollHeightRef.current = 0;
      prevScrollTopRef.current = 0;
      oldestMsgCursorRef.current = null;
    }
  }, [conversationId, dispatch]);

  // Join/leave conversation room for typing indicators
  useEffect(() => {
    if (!conversationId) return;
    appSocket.emit('conversation:join', { conversationId });
    return () => {
      appSocket.emit('conversation:leave', { conversationId });
    };
  }, [conversationId]);

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
  }, [conversationId, conversation, currentUser?.id]);

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

  // Restore scroll position BEFORE the browser paints to avoid visible jump.
  // useLayoutEffect is essential here — useEffect would run after paint, causing a flash.
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;

    if (loadingOlderRef.current && !loadingMessages && container) {
      const delta = container.scrollHeight - prevScrollHeightRef.current;
      const savedScrollTop = prevScrollTopRef.current;
      // Reset refs BEFORE setting scrollTop so any synchronous scroll event sees the correct state
      loadingOlderRef.current = false;
      prevScrollHeightRef.current = 0;
      prevScrollTopRef.current = 0;
      prevMessagesLenRef.current = messages.length;
      container.scrollTop = savedScrollTop + Math.max(delta, 0);
      return;
    }

    if (messages.length > prevMessagesLenRef.current) {
      const added = messages.length - prevMessagesLenRef.current;
      if (added <= 5 && !loadingMessages) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages.length, loadingMessages]);

  // Initial scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView();
    }, 100);
    return () => clearTimeout(timer);
  }, [conversationId]);

  // Filter out deleted messages for current user.
  // Also keep oldestMsgCursorRef up-to-date so handleScroll doesn't need messages in its deps.
  const visibleMessages = useMemo(() => {
    const filtered = messages.filter((m) => !(m.deletedFor ?? []).includes(currentUser?.id ?? ''));
    oldestMsgCursorRef.current = (filtered[0] ?? messages[0])?.createdAt ?? null;
    return filtered;
  }, [messages, currentUser]);

  // Load more on scroll to top.
  // Uses refs only (loadingOlderRef, oldestMsgCursorRef) — no stale closures over messages array.
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || loadingOlderRef.current || !hasMore) return;
    if (container.scrollTop < 100) {
      const cursor = oldestMsgCursorRef.current;
      if (cursor) {
        loadingOlderRef.current = true;
        prevScrollHeightRef.current = container.scrollHeight;
        prevScrollTopRef.current = container.scrollTop;
        dispatch(fetchMessages({ conversationId, cursor }));
      }
    }
  }, [conversationId, dispatch, hasMore]);

  // If list is too short to fill the viewport but server has more, auto-load additional batches.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || loadingMessages || loadingOlderRef.current || !hasMore) return;
    if (container.scrollHeight <= container.clientHeight + 20) {
      const cursor = oldestMsgCursorRef.current;
      if (cursor) {
        loadingOlderRef.current = true;
        prevScrollHeightRef.current = container.scrollHeight;
        prevScrollTopRef.current = container.scrollTop;
        dispatch(fetchMessages({ conversationId, cursor }));
      }
    }
  }, [conversationId, dispatch, hasMore, loadingMessages, messages.length]);

  // Core jump logic — tries immediately; if not rendered, triggers first fetch and queues retry
  const jumpToMessage = useCallback(
    (messageId: string) => {
      const el = msgRefs.current.get(messageId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedId(messageId);
        setTimeout(() => setHighlightedId(null), 2500);
        pendingJumpRef.current = null;
        return;
      }
      // Message not yet rendered — need to load older pages
      if (!hasMore) {
        toast.info('Tin nhắn không tồn tại hoặc đã bị xóa.');
        return;
      }
      const cursor = oldestMsgCursorRef.current;
      if (!cursor) return;
      // Queue the jump and dispatch the FIRST fetch immediately
      pendingJumpRef.current = { messageId, attempts: 1 };
      loadingOlderRef.current = true;
      prevScrollHeightRef.current = messagesContainerRef.current?.scrollHeight ?? 0;
      prevScrollTopRef.current = messagesContainerRef.current?.scrollTop ?? 0;
      dispatch(fetchMessages({ conversationId, cursor }));
    },
    [conversationId, dispatch, hasMore]
  );

  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      jumpToMessage(messageId);
    },
    [jumpToMessage]
  );

  // Jump to message from AI search result: close panel, then jump
  const handleJumpToMessage = useCallback(
    (messageId: string, timestamp: string) => {
      void timestamp;
      setShowAiSearch(false);
      // Small delay to let the panel close animation finish
      setTimeout(() => jumpToMessage(messageId), 200);
    },
    [jumpToMessage]
  );

  // Effect: after each new batch of messages loads (messages.length changes), retry pending jump.
  // The FIRST fetch is triggered inside jumpToMessage itself; this handles retries 2..5.
  useEffect(() => {
    const pending = pendingJumpRef.current;
    if (!pending) return;

    // Wait a tick for React to finish assigning DOM refs before checking
    const timer = setTimeout(() => {
      const el = msgRefs.current.get(pending.messageId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedId(pending.messageId);
        setTimeout(() => setHighlightedId(null), 2500);
        pendingJumpRef.current = null;
        return;
      }

      if (pending.attempts >= 5 || !hasMore) {
        toast.info('Tin nhắn đã quá cũ hoặc không thể tải được.');
        pendingJumpRef.current = null;
        return;
      }

      // Target still not rendered — fetch next older page
      const cursor = oldestMsgCursorRef.current;
      if (cursor) {
        pendingJumpRef.current = { ...pending, attempts: pending.attempts + 1 };
        loadingOlderRef.current = true;
        prevScrollHeightRef.current = messagesContainerRef.current?.scrollHeight ?? 0;
        prevScrollTopRef.current = messagesContainerRef.current?.scrollTop ?? 0;
        dispatch(fetchMessages({ conversationId, cursor }));
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [messages.length, conversationId, dispatch, hasMore]);

  const myParticipant = conversation?.participants.find((p) => p.userId === currentUser?.id);
  const myRole = myParticipant?.role ?? 'member';
  const isAdminOrOwner = myRole === 'owner' || myRole === 'admin';

  const typingLabel = useMemo(() => {
    const typingIds = typingUsers[conversationId] ?? [];
    if (typingIds.length === 0) return null;
    if (typingIds.length === 1) return `${typingIds[0]} đang gõ...`;
    if (typingIds.length === 2) return `${typingIds[0]} và ${typingIds[1]} đang gõ...`;
    return `${typingIds.length} người đang gõ...`;
  }, [typingUsers, conversationId]);

  const allPinned = pinnedMessages[conversationId] ?? [];
  const [pinnedBannerIdx, setPinnedBannerIdx] = useState(0);

  // Reset banner index when conversation changes or list length changes
  useEffect(() => {
    setPinnedBannerIdx(0);
  }, [conversationId, allPinned.length]);

  const currentPinned = allPinned[pinnedBannerIdx] ?? null;

  // Zalo-style pin action notification (bottom of message area)
  const [pinNotif, setPinNotif] = useState<{
    messageId: string;
    preview: string;
    action: 'pin' | 'unpin';
  } | null>(null);
  const pinNotifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPinNotif = useCallback(
    (messageId: string, preview: string, action: 'pin' | 'unpin') => {
      if (pinNotifTimer.current) clearTimeout(pinNotifTimer.current);
      setPinNotif({ messageId, preview, action });
      pinNotifTimer.current = setTimeout(() => setPinNotif(null), 4000);
    },
    []
  );

  // Restricted input: only admin/owner can send when onlyAdminCanSend is on
  const isOnlyAdminCanSend = !!(conversation?.settings as any)?.onlyAdminCanSend;
  const isOnlyAdminCanPin = !!(conversation?.settings as any)?.onlyAdminCanPin;
  const isBannedMember = !!myParticipant?.isBanned;
  const isInputRestricted = isOnlyAdminCanSend && !isAdminOrOwner;

  // ── Call initiation ──────────────────────────────────────────────────────
  const callState = useAppSelector((s) => s.call);

  const initiateCall = useCallback(
    (callType: 'audio' | 'video') => {
      if (!conversation || !currentUser) return;
      if (callState.status !== 'idle') return; // already in a call

      const callId = crypto.randomUUID();
      const participantIds = conversation.participants
        .map((p) => p.userId)
        .filter((id) => id !== currentUser.id);

      appSocket.emit('call:initiate', {
        callId,
        conversationId,
        callType,
        participantIds,
        callerName: currentUser.fullName ?? 'Bạn',
        callerAvatar: currentUser.avatar,
      });

      dispatch(
        startCall({
          callId,
          conversationId,
          callType,
          participantIds: [...participantIds, currentUser.id],
          initiatorId: currentUser.id,
        })
      );
    },
    [callState.status, conversation, conversationId, currentUser, dispatch]
  );

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
          {/* AI buttons */}
          <button
            onClick={() => {
              setShowAiSearch((v) => !v);
              setShowAiBot(false);
            }}
            title="Tìm kiếm thông minh (AI)"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              showAiSearch ? 'bg-[#EBF3FF] text-[#0068FF]' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowAiSummary(true)}
            title="Tóm tắt cuộc trò chuyện (AI)"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <FileText className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setShowAiBot((v) => !v);
              setShowAiSearch(false);
            }}
            title="BinChat AI Bot"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              showAiBot ? 'bg-[#EBF3FF] text-[#0068FF]' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Bot className="w-5 h-5" />
          </button>
          {/* Call buttons */}
          {callState.status === 'idle' && (
            <>
              <button
                onClick={() => initiateCall('audio')}
                title="Gọi thoại"
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={() => initiateCall('video')}
                title="Gọi video"
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Ongoing group call rejoin banner */}
        {callState.ongoingGroupCall?.conversationId === conversationId &&
          callState.status === 'idle' && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-green-500/10 border-b border-green-500/20 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[13px] text-green-700 font-medium flex-1">
                Đang có cuộc gọi nhóm
              </span>
              <button
                onClick={() => {
                  const ongoing = callState.ongoingGroupCall!;
                  appSocket.emit('call:accept', { callId: ongoing.callId });
                  dispatch(
                    acceptCall({
                      callId: ongoing.callId,
                      conversationId: ongoing.conversationId,
                      callType: ongoing.callType,
                      callerId: ongoing.callerId,
                      currentUserId: currentUser?.id,
                    })
                  );
                }}
                className="text-[12px] font-semibold text-green-600 hover:text-green-700 bg-green-500/20 hover:bg-green-500/30 px-3 py-1 rounded-full transition-colors"
              >
                Tham gia
              </button>
            </div>
          )}

        {/* Pinned message banner */}
        {currentPinned && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
            <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <button
              className="flex-1 min-w-0 text-left"
              onClick={() => handleScrollToMessage(currentPinned._id)}
            >
              <p className="text-[11px] font-semibold text-amber-600">
                Tin nhắn được ghim
                {allPinned.length > 1 && (
                  <span className="ml-1.5 font-normal text-amber-500">
                    {pinnedBannerIdx + 1}/{allPinned.length}
                  </span>
                )}
              </p>
              <p className="text-[12px] text-gray-600 truncate">
                {currentPinned.content || '[Tệp đính kèm]'}
              </p>
            </button>
            {allPinned.length > 1 && (
              <button
                onClick={() => setPinnedBannerIdx((i) => (i + 1) % allPinned.length)}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-amber-100 text-amber-500"
                title="Xem tin ghim tiếp theo"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

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

            // Show sender name in group chats (not for system messages)
            const isSystemMsg = msg.type === 'system' || msg.senderId === 'system';
            const showSenderName =
              !isSystemMsg && conversation?.type === 'group' && !isMine && showAvatar;

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
                  onEdit={() => setEditingMessage(msg)}
                  onPin={async () => {
                    const isPinned = pinnedMessages[conversationId]?.some((p) => p._id === msg._id);
                    try {
                      if (isPinned) {
                        await dispatch(
                          unpinMessage({ messageId: msg._id, conversationId })
                        ).unwrap();
                        showPinNotif(msg._id, msg.content || '[Tệp đính kèm]', 'unpin');
                      } else {
                        await dispatch(pinMessage({ messageId: msg._id, conversationId })).unwrap();
                        showPinNotif(msg._id, msg.content || '[Tệp đính kèm]', 'pin');
                      }
                    } catch (err: any) {
                      toast.error(err ?? 'Thao tác thất bại');
                    }
                  }}
                  isAdminOrOwner={isAdminOrOwner}
                  conversationType={conversation?.type}
                  onlyAdminCanPin={isOnlyAdminCanPin}
                />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingLabel && (
          <div className="px-4 py-1 flex items-center gap-1.5 bg-white border-t border-gray-100 flex-shrink-0">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:200ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:400ms]" />
            </span>
            <p className="text-[12px] text-gray-400 italic">{typingLabel}</p>
          </div>
        )}

        {/* Pin action notification (Zalo-style) */}
        {pinNotif && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e2e] text-white flex-shrink-0">
            <Pin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="flex-1 min-w-0 text-[13px] truncate">
              {pinNotif.action === 'pin' ? 'Bạn đã ghim' : 'Bạn đã bỏ ghim'} 1 tin nhắn{' '}
              <span className="text-gray-400">{pinNotif.preview}</span>
            </span>
            <button
              onClick={() => {
                handleScrollToMessage(pinNotif.messageId);
                setPinNotif(null);
              }}
              className="text-[13px] text-[#4DA3FF] font-medium flex-shrink-0 hover:underline"
            >
              Xem
            </button>
          </div>
        )}

        {/* Input */}
        {isBannedMember ? (
          <div className="flex items-center gap-2.5 px-4 py-3.5 bg-red-50 border-t border-red-100 flex-shrink-0">
            <Ban className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-[13px] text-red-600 flex-1">
              Bạn đang bị cấm gửi tin nhắn trong nhóm này.
            </p>
          </div>
        ) : isInputRestricted ? (
          <div className="flex items-center gap-2 px-4 py-3.5 bg-gray-800 border-t border-gray-700 flex-shrink-0">
            <Info className="w-4 h-4 text-gray-300 flex-shrink-0" />
            <p className="text-[13px] text-gray-200 flex-1">
              Chỉ trưởng/phó cộng đồng được gửi tin nhắn vào cộng đồng.
            </p>
          </div>
        ) : (
          <MessageInput
            conversationId={conversationId}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
            currentUserName={currentUser?.fullName ?? ''}
          />
        )}

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

      {/* AI Search panel */}
      {showAiSearch && (
        <AiSearchPanel
          conversationId={conversationId}
          onClose={() => setShowAiSearch(false)}
          onScrollToMessage={handleJumpToMessage}
          messages={messages}
        />
      )}

      {/* AI Bot panel */}
      {showAiBot && <AiBotPanel onClose={() => setShowAiBot(false)} />}

      {/* AI Summary modal */}
      <AiSummaryModal
        open={showAiSummary}
        onClose={() => setShowAiSummary(false)}
        conversationId={conversationId}
        messages={messages}
      />
    </div>
  );
}
