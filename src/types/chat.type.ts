import type { User } from './user.type';

export interface Attachment {
  url: string;
  type: 'image' | 'video' | 'file' | 'audio';
  filename: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface ReplyInfo {
  messageId: string;
  senderId: string;
  content: string;
  attachmentType?: 'image' | 'video' | 'file' | 'audio';
}

export interface ForwardInfo {
  messageId: string;
  conversationId: string;
  senderId: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type?: 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';
  attachments: Attachment[];
  deletedFor: string[];
  revokedAt: string | null;
  revokedBy?: string | null;
  forwardedFrom: ForwardInfo | null;
  replyTo: ReplyInfo | null;
  reactions: Reaction[];
  isEdited?: boolean;
  editedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  isBanned?: boolean;
  bannedUntil?: string | null;
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  muteUntil?: string | null;
  lastReadAt?: string | null;
}

export interface ConversationSettings {
  onlyAdminCanSend?: boolean;
  allowMemberInvite?: boolean;
  onlyAdminCanPin?: boolean;
  requireJoinApproval?: boolean;
  chatHistoryForNewMembers?: boolean;
}

export interface PinnedMessage {
  messageId: string;
  pinnedBy: string;
  pinnedAt: string;
}

export interface LastMessage {
  senderId: string;
  content: string;
  type: string;
  sentAt: string;
  revokedAt?: string | null;
}

export interface Conversation {
  _id: string;
  type: 'direct' | 'group';
  participants: Participant[];
  lastMessage: LastMessage | null;
  name?: string;
  avatar?: string;
  description?: string;
  settings?: ConversationSettings;
  pinnedMessages?: PinnedMessage[];
  createdAt: string;
  updatedAt: string;
  // Populated on frontend
  otherUser?: User;
}
