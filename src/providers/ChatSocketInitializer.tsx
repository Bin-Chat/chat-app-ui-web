import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { appSocket } from '@/services/appSocket';
import { chatServices } from '@/services/chatServices';
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
  socketGroupJoinRequested,
  socketGroupJoinApproved,
  socketGroupJoinDeclined,
  socketPollUpdated,
  socketPollDeleted,
  socketMessageEdited,
  socketMessagePinned,
  socketMessageUnpinned,
  socketTypingUpdate,
  fetchPinnedMessages,
  setUserOnline,
  setUserOffline,
  setPresenceBatch,
  fetchConversations,
  setIncomingCall,
  clearIncomingCall,
  endCall,
  removeParticipant,
  setOngoingGroupCall,
} from '@/store/slices';
import type { Message } from '@/types/chat.type';
import type { CallSliceState } from '@/store/slices';

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
  const n = new Notification(title, { body, icon: '/favicon.png', tag: msg.conversationId });
  setTimeout(() => n.close(), 5000);
}

export function ChatSocketInitializer() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const activeConversationId = useAppSelector((s) => s.chat.activeConversationId);
  // Stable ref for call state — used inside socket callbacks to avoid stale closures
  const call = useAppSelector((s) => s.call) as CallSliceState;
  const callRef = useRef<CallSliceState>(call);
  useEffect(() => {
    callRef.current = call;
  }, [call]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Map raw socket payload (messageId) to Message shape (_id)
    const onMessageNew = (payload: any) => {
      const createdAt = payload.createdAt ?? payload.timestamp ?? new Date().toISOString();
      const msg: Message = {
        _id: payload.messageId ?? payload._id,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        content: payload.content ?? '',
        type: payload.type,
        attachments: payload.attachments ?? [],
        deletedFor: [],
        revokedAt: null,
        forwardedFrom: null,
        replyTo: payload.replyTo ?? null,
        reactions: [],
        metadata: payload.metadata ?? null,
        createdAt: new Date(createdAt).toISOString(),
        updatedAt: new Date(createdAt).toISOString(),
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

    const onMessageRevoked = (payload: {
      messageId: string;
      conversationId: string;
      revokedBy?: string;
    }) => {
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
      action: 'added' | 'removed';
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
        })
      );
      // Always re-fetch to ensure banner is accurate even if message not in memory
      dispatch(fetchPinnedMessages(payload.conversationId));
    };
    const onMessageUnpinned = (payload: any) => {
      dispatch(
        socketMessageUnpinned({
          conversationId: payload.conversationId,
          messageId: payload.messageId,
        })
      );
      dispatch(fetchPinnedMessages(payload.conversationId));
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

    // ── Join Approval events ─────────────────────────────────────────
    const onGroupJoinRequested = (payload: any) => {
      dispatch(
        socketGroupJoinRequested({
          conversationId: payload.conversationId,
          requesterId: payload.requesterId,
          requestedAt: payload.requestedAt ?? new Date().toISOString(),
        })
      );
      toast.info('Có người muốn tham gia nhóm.', { autoClose: 5000 });
    };
    const onGroupJoinApproved = (payload: any) => {
      dispatch(
        socketGroupJoinApproved({
          conversationId: payload.conversationId,
          requesterId: payload.requesterId,
          allParticipantIds: payload.allParticipantIds ?? [],
        })
      );
      // If current user was the one approved, fetch the conversation so it appears in sidebar
      if (payload.requesterId === user.id) {
        dispatch(fetchConversations());
        toast.success('Yêu cầu tham gia nhóm của bạn đã được chấp nhận.', { autoClose: 5000 });
      }
    };
    const onGroupJoinDeclined = (payload: any) => {
      dispatch(
        socketGroupJoinDeclined({
          conversationId: payload.conversationId,
          requesterId: payload.requesterId,
        })
      );
      if (payload.requesterId === user.id) {
        toast.warn('Yêu cầu tham gia nhóm của bạn đã bị từ chối.', { autoClose: 5000 });
      }
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

    // ── Call events ──────────────────────────────────────────────────
    const onCallIncoming = (payload: {
      callId: string;
      conversationId: string;
      callType: 'audio' | 'video';
      callerId: string;
      callerName: string;
      callerAvatar?: string;
      participantIds?: string[];
    }) => {
      dispatch(setIncomingCall(payload));
      // Track ongoing group calls so users can rejoin after rejection/leaving
      if (payload.participantIds && payload.participantIds.length > 2) {
        dispatch(setOngoingGroupCall(payload));
      }
    };

    const onCallRejected = (payload: {
      callId: string;
      userId: string;
      conversationId?: string;
      callType?: 'audio' | 'video';
    }) => {
      // Only caller sends the system message (to avoid duplicates)
      if (callRef.current.initiatorId === user.id && payload.conversationId) {
        const callType = payload.callType ?? callRef.current.callType;
        const icon = callType === 'video' ? '📹' : '📞';
        const label = callType === 'video' ? 'video' : 'thoại';
        void chatServices
          .sendMessage(payload.conversationId, {
            content: `${icon} Cuộc gọi ${label} bị từ chối`,
            type: 'system',
          })
          .catch(console.error);
      }
      toast.info('Cuộc gọi bị từ chối.', { autoClose: 3000 });
      dispatch(endCall());
    };

    const onCallEnded = (payload: {
      callId?: string;
      conversationId?: string;
      outcome?: 'completed' | 'cancelled' | 'missed';
      duration?: number;
      callType?: 'audio' | 'video';
      endedBy?: string;
    }) => {
      const currentCall = callRef.current;
      const convId = payload.conversationId ?? currentCall.conversationId;
      // Only caller sends system messages to avoid duplicates.
      // 'cancelled' and 'completed (A hangs up)' are handled in CallRoom.handleHangUp.
      // Here we handle: missed (timeout) and completed (B hangs up).
      if (currentCall.initiatorId === user.id && convId) {
        const callType = payload.callType ?? currentCall.callType;
        const icon = callType === 'video' ? '📹' : '📞';
        const label = callType === 'video' ? 'video' : 'thoại';

        if (payload.outcome === 'missed') {
          void chatServices
            .sendMessage(convId, { content: `${icon} Cuộc gọi ${label} nhỡ`, type: 'system' })
            .catch(console.error);
        } else if (
          payload.outcome === 'completed' &&
          typeof payload.duration === 'number' &&
          payload.endedBy !== user.id // B hung up — A hasn't sent the message yet
        ) {
          const mins = Math.floor(payload.duration / 60);
          const secs = payload.duration % 60;
          const dur = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          void chatServices
            .sendMessage(convId, { content: `${icon} Cuộc gọi ${label} - ${dur}`, type: 'system' })
            .catch(console.error);
        }
      }
      dispatch(endCall());
    };

    // Gateway sends call:cancelled to participants who haven't accepted yet
    // (e.g. caller hung up before anyone answered, or 45s timeout)
    const onCallCancelled = () => {
      dispatch(clearIncomingCall());
      dispatch(setOngoingGroupCall(null));
    };

    // Someone left a GROUP call — only remove from participant list (call continues for others)
    const onCallParticipantLeft = (payload: { callId: string; userId: string }) => {
      dispatch(removeParticipant(payload.userId));
    };

    const onCallBusy = () => {
      toast.warn('Người dùng đang bận.', { autoClose: 3000 });
      dispatch(clearIncomingCall());
      dispatch(endCall());
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
    appSocket.on('group:join_requested', onGroupJoinRequested);
    appSocket.on('group:join_approved', onGroupJoinApproved);
    appSocket.on('group:join_declined', onGroupJoinDeclined);
    appSocket.on('user:online', onUserOnline);
    appSocket.on('user:offline', onUserOffline);
    appSocket.on('presence:result', onPresenceResult);
    appSocket.on('call:incoming', onCallIncoming);
    appSocket.on('call:rejected', onCallRejected);
    appSocket.on('call:ended', onCallEnded);
    appSocket.on('call:cancelled', onCallCancelled);
    appSocket.on('call:participant_left', onCallParticipantLeft);
    appSocket.on('call:busy', onCallBusy);

    const onReminderFire = (event: { content: string; conversationId: string }) => {
      // Browser Notification API — works even when window is minimized / tab not focused
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('⏰ Nhắc hẹn', {
          body: event.content,
          icon: '/favicon.png',
          tag: `reminder-${event.conversationId}`,
        });
        setTimeout(() => n.close(), 10000);
      }
      // In-app toast (always shown)
      toast.info(`⏰ Nhắc hẹn: ${event.content}`, {
        autoClose: 10000,
        position: 'top-right',
        toastId: `reminder-fire-${event.conversationId}`,
      });
    };
    const onReminderUpdated = (event: {
      reminderId: string;
      conversationId: string;
      reminder: any;
    }) => {
      window.dispatchEvent(
        new CustomEvent('reminder:updated', { detail: { reminder: event.reminder } })
      );
    };
    const onReminderDeleted = (event: { reminderId: string; conversationId: string }) => {
      window.dispatchEvent(
        new CustomEvent('reminder:deleted', { detail: { reminderId: event.reminderId } })
      );
    };
    const onNoteCreated = (event: { noteId: string; conversationId: string; note: any }) => {
      window.dispatchEvent(
        new CustomEvent('note:created', {
          detail: { conversationId: event.conversationId, note: event.note },
        })
      );
    };
    const onNoteUpdated = (event: { noteId: string; conversationId: string; note: any }) => {
      window.dispatchEvent(
        new CustomEvent('note:updated', {
          detail: { conversationId: event.conversationId, note: event.note },
        })
      );
    };
    const onNoteDeleted = (event: { noteId: string; conversationId: string }) => {
      window.dispatchEvent(
        new CustomEvent('note:deleted', {
          detail: { conversationId: event.conversationId, noteId: event.noteId },
        })
      );
    };
    appSocket.on('reminder:fire', onReminderFire);
    appSocket.on('reminder:updated', onReminderUpdated);
    appSocket.on('reminder:deleted', onReminderDeleted);
    appSocket.on('note:created', onNoteCreated);
    appSocket.on('note:updated', onNoteUpdated);
    appSocket.on('note:deleted', onNoteDeleted);

    const onPollUpdated = (event: {
      pollId: string;
      messageId: string;
      conversationId: string;
      poll: any;
    }) => {
      dispatch(
        socketPollUpdated({
          messageId: event.messageId,
          conversationId: event.conversationId,
          poll: event.poll,
        })
      );
    };
    const onPollDeleted = (event: {
      pollId: string;
      messageId: string;
      conversationId: string;
    }) => {
      dispatch(
        socketPollDeleted({
          messageId: event.messageId,
          conversationId: event.conversationId,
        })
      );
    };
    appSocket.on('poll:created', onPollUpdated);
    appSocket.on('poll:voted', onPollUpdated);
    appSocket.on('poll:option_added', onPollUpdated);
    appSocket.on('poll:updated', onPollUpdated);
    appSocket.on('poll:closed', onPollUpdated);
    appSocket.on('poll:deleted', onPollDeleted);

    // ── Tasks ────────────────────────────────────────────────────────
    const onTaskCreated = (event: any) => {
      if (Array.isArray(event.tasks)) {
        window.dispatchEvent(
          new CustomEvent('task:batch_created', {
            detail: { conversationId: event.conversationId, tasks: event.tasks },
          })
        );
      } else if (event.task) {
        window.dispatchEvent(
          new CustomEvent('task:created', {
            detail: { conversationId: event.conversationId, task: event.task },
          })
        );
      }
    };
    const onTaskUpdated = (event: any) => {
      window.dispatchEvent(
        new CustomEvent('task:updated', {
          detail: { conversationId: event.conversationId, task: event.task },
        })
      );
    };
    const onTaskCompleted = (event: any) => {
      window.dispatchEvent(
        new CustomEvent('task:completed', {
          detail: { conversationId: event.conversationId, task: event.task },
        })
      );
    };
    const onTaskDeleted = (event: any) => {
      window.dispatchEvent(
        new CustomEvent('task:deleted', {
          detail: { conversationId: event.conversationId, taskId: event.taskId },
        })
      );
    };
    const onTaskAssigned = (event: any) => {
      if (event.assigneeId !== user?.id) return;
      toast.info(`📋 Bạn được giao công việc: ${event.title}`, {
        autoClose: 8000,
        position: 'top-right',
      });
    };
    appSocket.on('task:created', onTaskCreated);
    appSocket.on('task:updated', onTaskUpdated);
    appSocket.on('task:completed', onTaskCompleted);
    appSocket.on('task:deleted', onTaskDeleted);
    appSocket.on('task:assigned', onTaskAssigned);

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
      appSocket.off('group:join_requested', onGroupJoinRequested);
      appSocket.off('group:join_approved', onGroupJoinApproved);
      appSocket.off('group:join_declined', onGroupJoinDeclined);
      appSocket.off('user:online', onUserOnline);
      appSocket.off('user:offline', onUserOffline);
      appSocket.off('presence:result', onPresenceResult);
      appSocket.off('call:incoming', onCallIncoming);
      appSocket.off('call:rejected', onCallRejected);
      appSocket.off('call:ended', onCallEnded);
      appSocket.off('call:cancelled', onCallCancelled);
      appSocket.off('call:participant_left', onCallParticipantLeft);
      appSocket.off('call:busy', onCallBusy);
      appSocket.off('reminder:fire', onReminderFire);
      appSocket.off('reminder:updated', onReminderUpdated);
      appSocket.off('reminder:deleted', onReminderDeleted);
      appSocket.off('note:created', onNoteCreated);
      appSocket.off('note:updated', onNoteUpdated);
      appSocket.off('note:deleted', onNoteDeleted);
      appSocket.off('poll:created', onPollUpdated);
      appSocket.off('poll:voted', onPollUpdated);
      appSocket.off('poll:option_added', onPollUpdated);
      appSocket.off('poll:updated', onPollUpdated);
      appSocket.off('poll:closed', onPollUpdated);
      appSocket.off('poll:deleted', onPollDeleted);
      appSocket.off('task:created', onTaskCreated);
      appSocket.off('task:updated', onTaskUpdated);
      appSocket.off('task:completed', onTaskCompleted);
      appSocket.off('task:deleted', onTaskDeleted);
      appSocket.off('task:assigned', onTaskAssigned);
    };
  }, [user, dispatch, activeConversationId]);

  return null;
}
