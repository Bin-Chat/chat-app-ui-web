import authorizedAxios from '@/utils/authorizedAxios';
import type { Conversation, Message, Participant } from '@/types/chat.type';
import type { Reminder } from '@/types/reminder.type';
import type { Note } from '@/types/note.type';
import type { PollView, CreatePollPayload } from '@/types/poll.type';

interface CreateConversationPayload {
  type: 'direct' | 'group';
  participantIds: string[];
  name?: string;
}

interface SendMessagePayload {
  content?: string;
  type?: string; // e.g. 'system' for call/group event messages
  replyTo?: {
    messageId: string;
    senderId: string;
    content: string;
    attachmentType?: string;
  } | null;
  attachments?: {
    url: string;
    type: 'image' | 'video' | 'file' | 'voice';
    filename: string;
    size?: number;
    mimeType?: string;
    width?: number;
    height?: number;
    duration?: number;
    thumbnailUrl?: string;
  }[];
}

interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

export const chatServices = {
  createConversation: (data: CreateConversationPayload) =>
    authorizedAxios.post<Conversation>('/api/chat/conversations', data).then((r) => r.data),

  getConversations: () =>
    authorizedAxios.get<Conversation[]>('/api/chat/conversations').then((r) => r.data),

  getConversation: (id: string) =>
    authorizedAxios.get<Conversation>(`/api/chat/conversations/${id}`).then((r) => r.data),

  getMessages: (conversationId: string, cursor?: string) =>
    authorizedAxios
      .get<MessagesResponse>(`/api/chat/conversations/${conversationId}/messages`, {
        params: { cursor, limit: 30 },
      })
      .then((r) => r.data),

  sendMessage: (conversationId: string, data: SendMessagePayload) =>
    authorizedAxios
      .post<Message>(`/api/chat/conversations/${conversationId}/messages`, data)
      .then((r) => r.data),

  revokeMessage: (messageId: string) =>
    authorizedAxios.patch(`/api/chat/messages/${messageId}/revoke`).then((r) => r.data),

  deleteMessage: (messageId: string) =>
    authorizedAxios.delete(`/api/chat/messages/${messageId}`).then((r) => r.data),

  forwardMessage: (messageId: string, targetConversationId: string) =>
    authorizedAxios
      .post<Message>(`/api/chat/messages/${messageId}/forward`, { targetConversationId })
      .then((r) => r.data),

  reactToMessage: (messageId: string, emoji: string) =>
    authorizedAxios.post(`/api/chat/messages/${messageId}/react`, { emoji }).then((r) => r.data),

  editMessage: (messageId: string, content: string) =>
    authorizedAxios
      .patch<Message>(`/api/chat/messages/${messageId}`, { content })
      .then((r) => r.data),

  pinMessage: (messageId: string) =>
    authorizedAxios.post(`/api/chat/messages/${messageId}/pin`).then((r) => r.data),

  unpinMessage: (messageId: string) =>
    authorizedAxios.delete(`/api/chat/messages/${messageId}/pin`).then((r) => r.data),

  getPinnedMessages: (conversationId: string) =>
    authorizedAxios
      .get<Message[]>(`/api/chat/conversations/${conversationId}/pinned`)
      .then((r) => r.data),

  markAsRead: (conversationId: string) =>
    authorizedAxios.post(`/api/chat/conversations/${conversationId}/read`).then((r) => r.data),

  // ── Group Management ──────────────────────────────────────────────

  getGroupMembers: (conversationId: string) =>
    authorizedAxios
      .get<Participant[]>(`/api/chat/conversations/${conversationId}/members`)
      .then((r) => r.data),

  addMembers: (conversationId: string, memberIds: string[]) =>
    authorizedAxios
      .post<Conversation>(`/api/chat/conversations/${conversationId}/members`, { memberIds })
      .then((r) => r.data),

  removeMember: (conversationId: string, memberId: string) =>
    authorizedAxios
      .delete<Conversation>(`/api/chat/conversations/${conversationId}/members/${memberId}`)
      .then((r) => r.data),

  leaveGroup: (conversationId: string) =>
    authorizedAxios.post(`/api/chat/conversations/${conversationId}/leave`).then((r) => r.data),

  updateGroup: (
    conversationId: string,
    data: { name?: string; avatar?: string; description?: string }
  ) =>
    authorizedAxios
      .patch<Conversation>(`/api/chat/conversations/${conversationId}`, data)
      .then((r) => r.data),

  changeRole: (conversationId: string, memberId: string, role: 'admin' | 'member') =>
    authorizedAxios
      .patch(`/api/chat/conversations/${conversationId}/role`, { memberId, role })
      .then((r) => r.data),

  transferOwnership: (conversationId: string, newOwnerId: string) =>
    authorizedAxios
      .patch(`/api/chat/conversations/${conversationId}/transfer`, { newOwnerId })
      .then((r) => r.data),

  dissolveGroup: (conversationId: string) =>
    authorizedAxios.delete(`/api/chat/conversations/${conversationId}`).then((r) => r.data),

  updateSettings: (
    conversationId: string,
    settings: {
      onlyAdminCanSend?: boolean;
      allowMemberInvite?: boolean;
      requireJoinApproval?: boolean;
      chatHistoryForNewMembers?: boolean;
    }
  ) =>
    authorizedAxios
      .patch(`/api/chat/conversations/${conversationId}/settings`, settings)
      .then((r) => r.data),

  banMember: (conversationId: string, memberId: string, bannedUntil?: string) =>
    authorizedAxios
      .post(`/api/chat/conversations/${conversationId}/members/${memberId}/ban`, { bannedUntil })
      .then((r) => r.data),

  unbanMember: (conversationId: string, memberId: string) =>
    authorizedAxios
      .delete(`/api/chat/conversations/${conversationId}/members/${memberId}/ban`)
      .then((r) => r.data),

  updateMySettings: (
    conversationId: string,
    settings: {
      isPinned?: boolean;
      isArchived?: boolean;
      isMuted?: boolean;
      muteUntil?: string;
    }
  ) =>
    authorizedAxios
      .patch(`/api/chat/conversations/${conversationId}/me`, settings)
      .then((r) => r.data),

  getConversationMedia: (
    conversationId: string,
    type: 'image' | 'file' | 'link',
    cursor?: string
  ) =>
    authorizedAxios
      .get(`/api/chat/conversations/${conversationId}/media`, {
        params: { type, cursor, limit: 20 },
      })
      .then(
        (r) =>
          r.data as {
            items: Record<string, unknown>[];
            hasMore: boolean;
            nextCursor: string | null;
          }
      ),

  // ── Reminders ─────────────────────────────────────────────────────────────

  createReminder: (
    conversationId: string,
    payload: { content: string; remindAt: string; repeat?: 'none' | 'daily' | 'weekly' | 'monthly' }
  ) =>
    authorizedAxios
      .post<Reminder>(`/api/chat/conversations/${conversationId}/reminders`, payload)
      .then((r) => r.data),

  getReminders: (conversationId: string) =>
    authorizedAxios
      .get<Reminder[]>(`/api/chat/conversations/${conversationId}/reminders`)
      .then((r) => r.data),

  updateReminder: (
    reminderId: string,
    payload: {
      content?: string;
      remindAt?: string;
      repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
    }
  ) =>
    authorizedAxios
      .patch<Reminder>(`/api/chat/reminders/${reminderId}`, payload)
      .then((r) => r.data),

  deleteReminder: (reminderId: string) =>
    authorizedAxios.delete(`/api/chat/reminders/${reminderId}`).then((r) => r.data),

  completeReminder: (reminderId: string) =>
    authorizedAxios
      .post<Reminder>(`/api/chat/reminders/${reminderId}/complete`)
      .then((r) => r.data),

  rsvpReminder: (reminderId: string, status: 'yes' | 'no', name: string) =>
    authorizedAxios
      .post<Reminder>(`/api/chat/reminders/${reminderId}/rsvp`, { status, name })
      .then((r) => r.data),

  // ── Notes ────────────────────────────────────────────────────────────────

  createNote: (conversationId: string, payload: { content: string; isPinned?: boolean }) =>
    authorizedAxios
      .post<Note>(`/api/chat/conversations/${conversationId}/notes`, payload)
      .then((r) => r.data),

  getNotes: (conversationId: string) =>
    authorizedAxios
      .get<Note[]>(`/api/chat/conversations/${conversationId}/notes`)
      .then((r) => r.data),

  updateNote: (noteId: string, payload: { content?: string; isPinned?: boolean }) =>
    authorizedAxios.patch<Note>(`/api/chat/notes/${noteId}`, payload).then((r) => r.data),

  deleteNote: (noteId: string) =>
    authorizedAxios.delete(`/api/chat/notes/${noteId}`).then((r) => r.data),

  // ── Polls ─────────────────────────────────────────────────────────────────

  createPoll: (conversationId: string, payload: CreatePollPayload) =>
    authorizedAxios
      .post<{
        poll: PollView;
        messageId: string;
      }>(`/api/chat/conversations/${conversationId}/polls`, payload)
      .then((r) => r.data),

  getPollsByConversation: (conversationId: string) =>
    authorizedAxios
      .get<PollView[]>(`/api/chat/conversations/${conversationId}/polls`)
      .then((r) => r.data),

  getPoll: (pollId: string) =>
    authorizedAxios.get<PollView>(`/api/chat/polls/${pollId}`).then((r) => r.data),

  votePoll: (pollId: string, optionIds: string[]) =>
    authorizedAxios
      .post<PollView>(`/api/chat/polls/${pollId}/vote`, { optionIds })
      .then((r) => r.data),

  addPollOption: (pollId: string, text: string) =>
    authorizedAxios
      .post<PollView>(`/api/chat/polls/${pollId}/options`, { text })
      .then((r) => r.data),

  updatePollOption: (pollId: string, optionId: string, text: string) =>
    authorizedAxios
      .patch<PollView>(`/api/chat/polls/${pollId}/options/${optionId}`, { text })
      .then((r) => r.data),

  deletePollOption: (pollId: string, optionId: string) =>
    authorizedAxios
      .delete<PollView>(`/api/chat/polls/${pollId}/options/${optionId}`)
      .then((r) => r.data),

  updatePoll: (pollId: string, question: string) =>
    authorizedAxios.patch<PollView>(`/api/chat/polls/${pollId}`, { question }).then((r) => r.data),

  closePoll: (pollId: string) =>
    authorizedAxios.patch<PollView>(`/api/chat/polls/${pollId}/close`).then((r) => r.data),

  deletePoll: (pollId: string) =>
    authorizedAxios.delete(`/api/chat/polls/${pollId}`).then((r) => r.data),
};
