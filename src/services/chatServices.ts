import authorizedAxios from '@/utils/authorizedAxios';
import type { Conversation, Message, Participant } from '@/types/chat.type';

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
    type: 'image' | 'video' | 'file';
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
};
