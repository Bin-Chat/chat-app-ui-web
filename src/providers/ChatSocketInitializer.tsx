import { useEffect } from 'react';
import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { appSocket } from '@/services/appSocket';
import {
  socketMessageNew,
  socketMessageRevoked,
  socketConversationUpdated,
  socketReactionToggled,
  socketGroupMembersAdded,
  socketGroupMemberRemoved,
  socketGroupMemberLeft,
  socketGroupUpdated,
  socketGroupRoleChanged,
  socketGroupDissolved,
  socketGroupOwnerTransferred,
  socketMemberBanned,
  socketMemberUnbanned,
  socketMessageEdited,
  socketMessagePinned,
  socketMessageUnpinned,
  socketTypingUpdate,
  setUserOnline,
  setUserOffline,
  setPresenceBatch,
  fetchConversations,
} from '@/store/slices';
import type { Message } from '@/types/chat.type';

/** Request browser notification permission once on mount */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBrowserNotification(msg: Message, senderName?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // in-app toast handles focused tab

  const title = senderName ?? 'Tin nhắn mới';
  const body = msg.content || (msg.attachments.length > 0 ? '[Tệp đính kèm]' : '');
  const n = new Notification(title, { body, icon: '/favicon.ico', tag: msg.conversationId });
  setTimeout(() => n.close(), 5000);
}

export function ChatSocketInitializer() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeConversationId = useAppSelector((s) => s.chat.activeConversationId);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Map raw socket payload (messageId) to Message shape (_id)
    const onMessageNew = (payload: any) => {
      const msg: Message = {
        _id: payload.messageId ?? payload._id,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        content: payload.content ?? '',
        attachments: payload.attachments ?? [],
        deletedFor: [],
        revokedAt: null,
        forwardedFrom: null,
        replyTo: payload.replyTo ?? null,
        reactions: [],
        createdAt: new Date(payload.createdAt).toISOString(),
        updatedAt: new Date(payload.createdAt).toISOString(),
      };
      dispatch(socketMessageNew(msg));
      // Notify only when message is from someone else
      if (msg.senderId !== user.id) {
        // In-app toast when user is in a different conversation or tab is focused
        const isCurrentConv = msg.conversationId === activeConversationId;
        if (!isCurrentConv) {
          const senderDisplay = payload.senderName ?? 'Tin nhắn mới';
          const body = msg.content || (msg.attachments.length > 0 ? '[Tệp đính kèm]' : '...');
          toast.info(`${senderDisplay}: ${body}`, {
            toastId: `msg-${msg._id}`,
            autoClose: 4000,
            position: 'top-right',
          });
        }
        // Browser notification when tab is not focused
        showBrowserNotification(msg, payload.senderName);
      }
    };

    const onMessageRevoked = (payload: { messageId: string; conversationId: string }) => {
      dispatch(socketMessageRevoked(payload));
    };

    const onConversationUpdated = (payload: {
      conversationId: string;
      lastMessage: any;
      [key: string]: any;
    }) => {
      if (!payload?.conversationId) return;
      // The Kafka event has `conversationId`, but the reducer looks for `_id`.
      // Map it here so the reducer can find the existing conversation.
      dispatch(
        socketConversationUpdated({
          _id: payload.conversationId,
          lastMessage: payload.lastMessage,
        })
      );
    };

    const onReactionToggled = (payload: {
      messageId: string;
      conversationId: string;
      userId: string;
      emoji: string;
    }) => {
      dispatch(socketReactionToggled(payload));
    };

    // ── Group events ────────────────────────────────────────────────
    const onGroupMembersAdded = (payload: any) => {
      // Backend sends `newMemberIds`, normalize to `addedUserIds` for reducer
      const addedUserIds = payload.newMemberIds || payload.addedUserIds || [];
      dispatch(socketGroupMembersAdded({ ...payload, addedUserIds }));
      // If current user was added to a new group, refresh conversations
      if (addedUserIds.includes(user.id)) {
        dispatch(fetchConversations());
      }
    };
    const onGroupMemberRemoved = (payload: any) => {
      // Backend sends `removedMemberId`, normalize to `removedUserId` for reducer
      const removedUserId = payload.removedUserId || payload.removedMemberId;
      dispatch(socketGroupMemberRemoved({ ...payload, removedUserId }));
      // If current user was removed, refresh conversations
      if (removedUserId === user.id) {
        dispatch(fetchConversations());
      }
    };
    const onGroupMemberLeft = (payload: any) => {
      dispatch(socketGroupMemberLeft(payload));
    };
    const onGroupUpdated = (payload: any) => {
      // Backend sends updates in `changes` object, flatten for reducer
      const normalized = {
        conversationId: payload.conversationId,
        ...payload.changes,
      };
      dispatch(socketGroupUpdated(normalized));
    };
    const onGroupRoleChanged = (payload: any) => {
      // Backend sends `memberId`, normalize to `targetUserId` for reducer
      const targetUserId = payload.targetUserId || payload.memberId;
      dispatch(socketGroupRoleChanged({ ...payload, targetUserId }));
    };
    const onGroupDissolved = (payload: any) => {
      dispatch(socketGroupDissolved(payload));
    };
    const onGroupOwnerTransferred = (payload: any) => {
      dispatch(socketGroupOwnerTransferred(payload));
    };

    // ── New feature events ───────────────────────────────────────────
    const onMessageEdited = (payload: any) => {
      dispatch(
        socketMessageEdited({
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          content: payload.content,
          isEdited: true,
          editedAt: payload.editedAt,
        })
      );
    };
    const onMessagePinned = (payload: any) => {
      dispatch(
        socketMessagePinned({
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          pinnedBy: payload.pinnedBy,
          pinnedAt: payload.pinnedAt,
        })
      );
    };
    const onMessageUnpinned = (payload: any) => {
      dispatch(
        socketMessageUnpinned({
          conversationId: payload.conversationId,
          messageId: payload.messageId,
        })
      );
    };
    const onTypingUpdate = (payload: { conversationId: string; typingUserIds: string[] }) => {
      dispatch(socketTypingUpdate(payload));
    };
    const onConversationSettings = (payload: any) => {
      dispatch(
        socketConversationUpdated({
          _id: payload.conversationId,
          settings: payload.settings,
        })
      );
    };
    const onMemberBanned = (payload: any) => {
      dispatch(
        socketMemberBanned({
          conversationId: payload.conversationId,
          memberId: payload.memberId,
          bannedUntil: payload.bannedUntil ?? null,
        })
      );
      // If current user was banned, also refresh to get updated state
      if (payload.memberId === user.id) {
        dispatch(fetchConversations());
      }
    };
    const onMemberUnbanned = (payload: any) => {
      dispatch(
        socketMemberUnbanned({
          conversationId: payload.conversationId,
          memberId: payload.memberId,
        })
      );
    };

    // ── Presence events ─────────────────────────────────────────────
    const onUserOnline = (payload: { userId: string }) => {
      dispatch(setUserOnline(payload));
    };
    const onUserOffline = (payload: { userId: string; lastSeen: string }) => {
      dispatch(setUserOffline(payload));
    };
    const onPresenceResult = (payload: Record<string, { online: boolean; lastSeen?: string }>) => {
      dispatch(setPresenceBatch(payload));
    };

    appSocket.on('message:new', onMessageNew);
    appSocket.on('message:revoked', onMessageRevoked);
    appSocket.on('conversation:updated', onConversationUpdated);
    appSocket.on('message:reaction', onReactionToggled);
    appSocket.on('group:members_added', onGroupMembersAdded);
    appSocket.on('group:member_removed', onGroupMemberRemoved);
    appSocket.on('group:member_left', onGroupMemberLeft);
    appSocket.on('group:updated', onGroupUpdated);
    appSocket.on('group:role_changed', onGroupRoleChanged);
    appSocket.on('group:dissolved', onGroupDissolved);
    appSocket.on('group:owner_transferred', onGroupOwnerTransferred);
    appSocket.on('message:edited', onMessageEdited);
    appSocket.on('message:pinned', onMessagePinned);
    appSocket.on('message:unpinned', onMessageUnpinned);
    appSocket.on('typing:update', onTypingUpdate);
    appSocket.on('conversation:settings', onConversationSettings);
    appSocket.on('member:banned', onMemberBanned);
    appSocket.on('member:unbanned', onMemberUnbanned);
    appSocket.on('user:online', onUserOnline);
    appSocket.on('user:offline', onUserOffline);
    appSocket.on('presence:result', onPresenceResult);

    return () => {
      appSocket.off('message:new', onMessageNew);
      appSocket.off('message:revoked', onMessageRevoked);
      appSocket.off('conversation:updated', onConversationUpdated);
      appSocket.off('message:reaction', onReactionToggled);
      appSocket.off('group:members_added', onGroupMembersAdded);
      appSocket.off('group:member_removed', onGroupMemberRemoved);
      appSocket.off('group:member_left', onGroupMemberLeft);
      appSocket.off('group:updated', onGroupUpdated);
      appSocket.off('group:role_changed', onGroupRoleChanged);
      appSocket.off('group:dissolved', onGroupDissolved);
      appSocket.off('group:owner_transferred', onGroupOwnerTransferred);
      appSocket.off('message:edited', onMessageEdited);
      appSocket.off('message:pinned', onMessagePinned);
      appSocket.off('message:unpinned', onMessageUnpinned);
      appSocket.off('typing:update', onTypingUpdate);
      appSocket.off('conversation:settings', onConversationSettings);
      appSocket.off('member:banned', onMemberBanned);
      appSocket.off('member:unbanned', onMemberUnbanned);
      appSocket.off('user:online', onUserOnline);
      appSocket.off('user:offline', onUserOffline);
      appSocket.off('presence:result', onPresenceResult);
    };
  }, [user, dispatch]);

  return null;
}
