import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { chatServices } from '@/services/chatServices';
import { userServices, type UserProfile } from '@/services/userServices';
import type { Conversation, Message, Participant, PendingMember } from '@/types/chat.type';

export interface PresenceInfo {
  online: boolean;
  lastSeen?: string;
}

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  loadingConversations: boolean;
  loadingMessages: boolean;
  sendingMessage: boolean;
  error: string | null;
  /** Number of unread messages per conversation (reset when conversation is opened) */
  unreadCounts: Record<string, number>;
  /** Cached user profiles for group members (keyed by userId) */
  groupMemberProfiles: Record<string, UserProfile>;
  /** Online presence status for users (keyed by userId) */
  userPresence: Record<string, PresenceInfo>;
  /** Currently typing users per conversation: conversationId → string[] of userIds */
  typingUsers: Record<string, string[]>;
  /** Pinned messages per conversation */
  pinnedMessages: Record<string, Message[]>;
  /** Pending join requests per conversation (keyed by conversationId) */
  pendingJoinRequests: Record<string, PendingMember[]>;
}

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  messages: {},
  hasMore: {},
  loadingConversations: false,
  loadingMessages: false,
  sendingMessage: false,
  error: null,
  unreadCounts: {},
  groupMemberProfiles: {},
  userPresence: {},
  typingUsers: {},
  pinnedMessages: {},
  pendingJoinRequests: {},
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchConversations = createAsyncThunk<
  { conversations: Conversation[]; unreadCounts: Record<string, number> },
  void,
  { rejectValue: string }
>('chat/fetchConversations', async (_, thunkAPI) => {
  try {
    const userId = (thunkAPI.getState() as any).auth?.user?.id ?? '';
    const conversations = await chatServices.getConversations();
    // Compute unread from lastMessage.sentAt vs participant.lastReadAt
    const unreadCounts: Record<string, number> = {};
    for (const conv of conversations) {
      if (!conv.lastMessage) continue;
      const me = conv.participants.find((p) => p.userId === userId);
      if (!me) continue;
      const lastRead = me.lastReadAt;
      if (!lastRead || new Date(conv.lastMessage.sentAt) > new Date(lastRead)) {
        unreadCounts[conv._id] = 1;
      }
    }
    return { conversations, unreadCounts };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể tải danh sách hội thoại');
  }
});

export const createConversation = createAsyncThunk<
  Conversation,
  { participantIds: string[]; type?: 'direct' | 'group'; name?: string },
  { rejectValue: string }
>('chat/createConversation', async (payload, thunkAPI) => {
  try {
    return await chatServices.createConversation({
      type: payload.type ?? 'direct',
      participantIds: payload.participantIds,
      name: payload.name,
    });
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể tạo hội thoại');
  }
});

export const fetchMessages = createAsyncThunk<
  { conversationId: string; messages: Message[]; hasMore: boolean },
  { conversationId: string; cursor?: string },
  { rejectValue: string }
>('chat/fetchMessages', async ({ conversationId, cursor }, thunkAPI) => {
  try {
    const data = await chatServices.getMessages(conversationId, cursor);
    return { conversationId, messages: data.messages, hasMore: data.hasMore };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể tải tin nhắn');
  }
});

export const sendMessage = createAsyncThunk<
  Message,
  { conversationId: string; content?: string; attachments?: any[]; replyTo?: any },
  { rejectValue: string }
>('chat/sendMessage', async ({ conversationId, content, attachments, replyTo }, thunkAPI) => {
  try {
    return await chatServices.sendMessage(conversationId, { content, attachments, replyTo });
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể gửi tin nhắn');
  }
});

export const revokeMessage = createAsyncThunk<
  { messageId: string; conversationId: string },
  { messageId: string; conversationId: string },
  { rejectValue: string }
>('chat/revokeMessage', async ({ messageId, conversationId }, thunkAPI) => {
  try {
    await chatServices.revokeMessage(messageId);
    return { messageId, conversationId };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể thu hồi tin nhắn');
  }
});

export const deleteMessage = createAsyncThunk<
  { messageId: string; conversationId: string },
  { messageId: string; conversationId: string },
  { rejectValue: string }
>('chat/deleteMessage', async ({ messageId, conversationId }, thunkAPI) => {
  try {
    await chatServices.deleteMessage(messageId);
    return { messageId, conversationId };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể xóa tin nhắn');
  }
});

export const forwardMessage = createAsyncThunk<
  Message,
  { messageId: string; targetConversationId: string },
  { rejectValue: string }
>('chat/forwardMessage', async ({ messageId, targetConversationId }, thunkAPI) => {
  try {
    return await chatServices.forwardMessage(messageId, targetConversationId);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể chuyển tiếp tin nhắn');
  }
});

export const reactToMessage = createAsyncThunk<
  { messageId: string; conversationId: string; emoji: string; userId: string },
  { messageId: string; conversationId: string; emoji: string; userId: string },
  { rejectValue: string }
>('chat/reactToMessage', async ({ messageId, conversationId, emoji, userId }, thunkAPI) => {
  try {
    await chatServices.reactToMessage(messageId, emoji);
    return { messageId, conversationId, emoji, userId };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể thêm reaction');
  }
});

// ── Group Management Thunks ───────────────────────────────────────────────

export const fetchGroupMembers = createAsyncThunk<
  { conversationId: string; members: Participant[] },
  string,
  { rejectValue: string }
>('chat/fetchGroupMembers', async (conversationId, thunkAPI) => {
  try {
    const members = await chatServices.getGroupMembers(conversationId);
    return { conversationId, members };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể tải danh sách thành viên');
  }
});

export const addGroupMembers = createAsyncThunk<
  { success: boolean; addedCount?: number; pendingCount?: number; status?: string },
  { conversationId: string; memberIds: string[] },
  { rejectValue: string }
>('chat/addGroupMembers', async ({ conversationId, memberIds }, thunkAPI) => {
  try {
    return await chatServices.addMembers(conversationId, memberIds);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể thêm thành viên');
  }
});

export const removeGroupMember = createAsyncThunk<
  Conversation,
  { conversationId: string; memberId: string },
  { rejectValue: string }
>('chat/removeGroupMember', async ({ conversationId, memberId }, thunkAPI) => {
  try {
    return await chatServices.removeMember(conversationId, memberId);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể xóa thành viên');
  }
});

export const leaveGroup = createAsyncThunk<
  { conversationId: string },
  string,
  { rejectValue: string }
>('chat/leaveGroup', async (conversationId, thunkAPI) => {
  try {
    await chatServices.leaveGroup(conversationId);
    return { conversationId };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể rời nhóm');
  }
});

export const updateGroup = createAsyncThunk<
  Conversation,
  { conversationId: string; data: { name?: string; avatar?: string; description?: string } },
  { rejectValue: string }
>('chat/updateGroup', async ({ conversationId, data }, thunkAPI) => {
  try {
    return await chatServices.updateGroup(conversationId, data);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể cập nhật nhóm');
  }
});

export const changeGroupRole = createAsyncThunk<
  void,
  { conversationId: string; memberId: string; role: 'admin' | 'member' },
  { rejectValue: string }
>('chat/changeGroupRole', async ({ conversationId, memberId, role }, thunkAPI) => {
  try {
    await chatServices.changeRole(conversationId, memberId, role);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể thay đổi vai trò');
  }
});

export const transferGroupOwnership = createAsyncThunk<
  void,
  { conversationId: string; newOwnerId: string },
  { rejectValue: string }
>('chat/transferGroupOwnership', async ({ conversationId, newOwnerId }, thunkAPI) => {
  try {
    await chatServices.transferOwnership(conversationId, newOwnerId);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể chuyển quyền');
  }
});

export const dissolveGroup = createAsyncThunk<
  { conversationId: string },
  string,
  { rejectValue: string }
>('chat/dissolveGroup', async (conversationId, thunkAPI) => {
  try {
    await chatServices.dissolveGroup(conversationId);
    return { conversationId };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể giải tán nhóm');
  }
});

// ── Fetch Group Member Profiles ───────────────────────────────────────────

export const fetchGroupMemberProfiles = createAsyncThunk<
  UserProfile[],
  string[],
  { rejectValue: string }
>('chat/fetchGroupMemberProfiles', async (userIds, thunkAPI) => {
  try {
    const state = thunkAPI.getState() as { chat: ChatState };
    const missingIds = userIds.filter((id) => !state.chat.groupMemberProfiles[id]);
    if (missingIds.length === 0) return [];
    return await userServices.getUsersByIds(missingIds);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể tải thông tin thành viên');
  }
});

// ── New thunks ────────────────────────────────────────────────────────────────

export const editMessage = createAsyncThunk<
  Message,
  { messageId: string; conversationId: string; content: string },
  { rejectValue: string }
>('chat/editMessage', async ({ messageId, content }, thunkAPI) => {
  try {
    return await chatServices.editMessage(messageId, content);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(
      err?.response?.data?.message ?? err.message ?? 'Không thể chỉnh sửa tin nhắn'
    );
  }
});

export const pinMessage = createAsyncThunk<
  void,
  { messageId: string; conversationId: string },
  { rejectValue: string }
>('chat/pinMessage', async ({ messageId, conversationId }, thunkAPI) => {
  try {
    await chatServices.pinMessage(messageId);
    thunkAPI.dispatch(fetchPinnedMessages(conversationId));
  } catch (err: any) {
    return thunkAPI.rejectWithValue(
      err?.response?.data?.message ?? err.message ?? 'Không thể ghim tin nhắn'
    );
  }
});

export const unpinMessage = createAsyncThunk<
  void,
  { messageId: string; conversationId: string },
  { rejectValue: string }
>('chat/unpinMessage', async ({ messageId, conversationId }, thunkAPI) => {
  try {
    await chatServices.unpinMessage(messageId);
    thunkAPI.dispatch(fetchPinnedMessages(conversationId));
  } catch (err: any) {
    return thunkAPI.rejectWithValue(
      err?.response?.data?.message ?? err.message ?? 'Không thể bỏ ghim tin nhắn'
    );
  }
});

export const fetchPinnedMessages = createAsyncThunk<
  { conversationId: string; messages: Message[] },
  string,
  { rejectValue: string }
>('chat/fetchPinnedMessages', async (conversationId, thunkAPI) => {
  try {
    const messages = await chatServices.getPinnedMessages(conversationId);
    return { conversationId, messages };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể tải tin nhắn đã ghim');
  }
});

export const updateGroupSettings = createAsyncThunk<
  { conversationId: string; settings: Record<string, boolean> },
  { conversationId: string; settings: Record<string, boolean> },
  { rejectValue: string }
>('chat/updateGroupSettings', async ({ conversationId, settings }, thunkAPI) => {
  try {
    await chatServices.updateSettings(conversationId, settings);
    return { conversationId, settings };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(
      err?.response?.data?.message ?? err.message ?? 'Không thể cập nhật cài đặt'
    );
  }
});

export const banGroupMember = createAsyncThunk<
  void,
  { conversationId: string; memberId: string; bannedUntil?: string },
  { rejectValue: string }
>('chat/banGroupMember', async ({ conversationId, memberId, bannedUntil }, thunkAPI) => {
  try {
    await chatServices.banMember(conversationId, memberId, bannedUntil);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(
      err?.response?.data?.message ?? err.message ?? 'Không thể cấm thành viên'
    );
  }
});

export const unbanGroupMember = createAsyncThunk<
  void,
  { conversationId: string; memberId: string },
  { rejectValue: string }
>('chat/unbanGroupMember', async ({ conversationId, memberId }, thunkAPI) => {
  try {
    await chatServices.unbanMember(conversationId, memberId);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(
      err?.response?.data?.message ?? err.message ?? 'Không thể bỏ cấm'
    );
  }
});

// ── Slice ─────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversation: (state, action: PayloadAction<string | null>) => {
      state.activeConversationId = action.payload;
      // Clear unread count when opening a conversation
      if (action.payload) {
        state.unreadCounts[action.payload] = 0;
      }
    },
    clearChatError: (state) => {
      state.error = null;
    },
    // Socket-driven reducers
    socketMessageNew: (state, action: PayloadAction<Message>) => {
      const msg = action.payload;
      const convId = msg.conversationId;
      if (state.messages[convId]) {
        const exists = state.messages[convId].some((m) => m._id === msg._id);
        if (!exists) state.messages[convId].push(msg);
      }
      // Increment unread count when the conversation is not currently open
      if (convId !== state.activeConversationId) {
        state.unreadCounts[convId] = (state.unreadCounts[convId] ?? 0) + 1;
      }
      // Update lastMessage on conversation
      const conv = state.conversations.find((c) => c._id === convId);
      if (conv) {
        conv.lastMessage = {
          senderId: msg.senderId,
          content: msg.content || (msg.attachments?.length ? '[Tệp đính kèm]' : ''),
          type: msg.attachments?.length ? 'attachment' : 'text',
          sentAt: msg.createdAt,
        };
        // Move conversation to top
        state.conversations = [conv, ...state.conversations.filter((c) => c._id !== convId)];
      }
    },
    socketMessageRevoked: (
      state,
      action: PayloadAction<{ messageId: string; conversationId: string; revokedBy?: string }>
    ) => {
      const { messageId, conversationId, revokedBy } = action.payload;
      const msgs = state.messages[conversationId];
      if (msgs) {
        const msg = msgs.find((m) => m._id === messageId);
        if (msg) {
          msg.revokedAt = new Date().toISOString();
          if (revokedBy) msg.revokedBy = revokedBy;
        }
      }
      // Also update lastMessage on conversation if it refers to this message
      const conv = state.conversations.find((c) => c._id === conversationId);
      if (conv?.lastMessage) {
        const msgs2 = state.messages[conversationId];
        const isLast = msgs2 && msgs2.length > 0 && msgs2[msgs2.length - 1]?._id === messageId;
        if (isLast) {
          conv.lastMessage = { ...conv.lastMessage, revokedAt: new Date().toISOString() };
        }
      }
    },
    socketMessageRestored: (
      state,
      action: PayloadAction<{ messageId: string; conversationId: string }>
    ) => {
      const { messageId, conversationId } = action.payload;
      const msgs = state.messages[conversationId];
      if (msgs) {
        const msg = msgs.find((item) => item._id === messageId);
        if (msg) {
          msg.revokedAt = null;
          msg.revokedBy = null;
        }
      }
      const conv = state.conversations.find((item) => item._id === conversationId);
      if (conv?.lastMessage) {
        const isLast = msgs && msgs.length > 0 && msgs[msgs.length - 1]?._id === messageId;
        if (isLast) conv.lastMessage = { ...conv.lastMessage, revokedAt: null };
      }
    },
    socketConversationUpdated: (
      state,
      action: PayloadAction<{
        _id: string;
        lastMessage?: any;
        settings?: Record<string, any>;
        [key: string]: any;
      }>
    ) => {
      const { _id, lastMessage, settings, ...rest } = action.payload;
      const idx = state.conversations.findIndex((c) => c._id === _id);
      // Only update existing conversations — NEVER insert unknown entries
      // (prevents the ghost "Nhóm chat" entry caused by ObjectId mapping mismatch)
      if (idx < 0) return;
      state.conversations[idx] = {
        ...state.conversations[idx],
        ...(lastMessage ? { lastMessage } : {}),
        ...(settings ? { settings: { ...state.conversations[idx].settings, ...settings } } : {}),
      };
      // Move updated conversation to top
      const [conv] = state.conversations.splice(idx, 1);
      state.conversations.unshift(conv);
    },
    socketReactionToggled: (
      state,
      action: PayloadAction<{
        messageId: string;
        conversationId: string;
        userId: string;
        emoji: string;
        action: 'added' | 'removed';
      }>
    ) => {
      const { messageId, conversationId, userId, emoji, action: reactionAction } = action.payload;
      const msgs = state.messages[conversationId];
      if (!msgs) return;
      const msg = msgs.find((m) => m._id === messageId);
      if (!msg) return;
      if (!msg.reactions) msg.reactions = [];
      // 1-per-user rule: remove any existing reaction from this user first
      msg.reactions = msg.reactions.filter((r) => r.userId !== userId);
      if (reactionAction === 'added') {
        msg.reactions.push({ userId, emoji });
      }
    },

    socketMessageEdited: (
      state,
      action: PayloadAction<{
        messageId: string;
        conversationId: string;
        content: string;
        editedAt: string;
      }>
    ) => {
      const { messageId, conversationId, content, editedAt } = action.payload;
      const msgs = state.messages[conversationId];
      if (!msgs) return;
      const msg = msgs.find((m) => m._id === messageId);
      if (msg) {
        msg.content = content;
        (msg as any).isEdited = true;
        (msg as any).editedAt = editedAt;
      }
    },

    socketMessagePinned: (
      state,
      action: PayloadAction<{ messageId: string; conversationId: string; pinnedBy: string }>
    ) => {
      const { messageId, conversationId, pinnedBy } = action.payload;
      if (!state.pinnedMessages[conversationId]) state.pinnedMessages[conversationId] = [];
      const msgs = state.messages[conversationId] ?? [];
      const msg = msgs.find((m) => m._id === messageId);
      if (msg && !state.pinnedMessages[conversationId].some((m) => m._id === messageId)) {
        state.pinnedMessages[conversationId].push({ ...msg, pinnedBy } as any);
      }
    },

    socketMessageUnpinned: (
      state,
      action: PayloadAction<{ messageId: string; conversationId: string }>
    ) => {
      const { messageId, conversationId } = action.payload;
      if (state.pinnedMessages[conversationId]) {
        state.pinnedMessages[conversationId] = state.pinnedMessages[conversationId].filter(
          (m) => m._id !== messageId
        );
      }
    },

    socketPollUpdated: (
      state,
      action: PayloadAction<{ messageId: string; conversationId: string; poll: any }>
    ) => {
      const { messageId, conversationId, poll } = action.payload;
      const msgs = state.messages[conversationId];
      if (!msgs) return;
      const idx = msgs.findIndex((m) => m._id === messageId);
      if (idx === -1) return;
      const msg = msgs[idx];
      msgs[idx] = {
        ...msg,
        metadata: { ...(msg.metadata ?? {}), type: 'poll', pollId: poll?._id, poll },
      };
    },

    socketPollDeleted: (
      state,
      action: PayloadAction<{ messageId: string; conversationId: string }>
    ) => {
      const { messageId, conversationId } = action.payload;
      const msgs = state.messages[conversationId];
      if (!msgs) return;
      const idx = msgs.findIndex((m) => m._id === messageId);
      if (idx === -1) return;
      msgs[idx] = { ...msgs[idx], revokedAt: new Date().toISOString() } as any;
    },

    socketTypingUpdate: (
      state,
      action: PayloadAction<{ conversationId: string; typingUserIds: string[] }>
    ) => {
      state.typingUsers[action.payload.conversationId] = action.payload.typingUserIds;
    },

    // ── Group socket-driven reducers ─────────────────────────────────
    socketGroupMembersAdded: (
      state,
      action: PayloadAction<{
        conversationId: string;
        addedUserIds: string[];
        participants: string[];
      }>
    ) => {
      const conv = state.conversations.find((c) => c._id === action.payload.conversationId);
      if (conv) {
        for (const uid of action.payload.addedUserIds) {
          if (!conv.participants.some((p) => p.userId === uid)) {
            conv.participants.push({
              userId: uid,
              role: 'member',
              joinedAt: new Date().toISOString(),
            });
          }
        }
      }
    },
    socketGroupMemberRemoved: (
      state,
      action: PayloadAction<{ conversationId: string; removedUserId: string }>
    ) => {
      const { conversationId, removedUserId } = action.payload;
      const conv = state.conversations.find((c) => c._id === conversationId);
      if (conv) {
        conv.participants = conv.participants.filter((p) => p.userId !== removedUserId);
      }
    },
    socketGroupMemberLeft: (
      state,
      action: PayloadAction<{ conversationId: string; userId: string }>
    ) => {
      const { conversationId, userId } = action.payload;
      const conv = state.conversations.find((c) => c._id === conversationId);
      if (conv) {
        conv.participants = conv.participants.filter((p) => p.userId !== userId);
      }
    },
    socketGroupUpdated: (
      state,
      action: PayloadAction<{
        conversationId: string;
        name?: string;
        avatar?: string;
        description?: string;
      }>
    ) => {
      const conv = state.conversations.find((c) => c._id === action.payload.conversationId);
      if (conv) {
        if (action.payload.name) conv.name = action.payload.name;
        if (action.payload.avatar) conv.avatar = action.payload.avatar;
        if (action.payload.description !== undefined) conv.description = action.payload.description;
      }
    },
    socketGroupRoleChanged: (
      state,
      action: PayloadAction<{
        conversationId: string;
        targetUserId: string;
        newRole: 'admin' | 'member';
      }>
    ) => {
      const conv = state.conversations.find((c) => c._id === action.payload.conversationId);
      if (conv) {
        const p = conv.participants.find((pp) => pp.userId === action.payload.targetUserId);
        if (p) p.role = action.payload.newRole;
      }
    },
    socketGroupDissolved: (state, action: PayloadAction<{ conversationId: string }>) => {
      state.conversations = state.conversations.filter(
        (c) => c._id !== action.payload.conversationId
      );
      delete state.messages[action.payload.conversationId];
      delete state.hasMore[action.payload.conversationId];
      if (state.activeConversationId === action.payload.conversationId) {
        state.activeConversationId = null;
      }
    },
    socketGroupOwnerTransferred: (
      state,
      action: PayloadAction<{ conversationId: string; oldOwnerId: string; newOwnerId: string }>
    ) => {
      const conv = state.conversations.find((c) => c._id === action.payload.conversationId);
      if (conv) {
        const oldOwner = conv.participants.find((p) => p.userId === action.payload.oldOwnerId);
        if (oldOwner) oldOwner.role = 'admin';
        const newOwner = conv.participants.find((p) => p.userId === action.payload.newOwnerId);
        if (newOwner) {
          newOwner.role = 'owner';
          (newOwner as any).isBanned = false;
          (newOwner as any).bannedUntil = null;
        }
      }
    },
    socketMemberBanned: (
      state,
      action: PayloadAction<{
        conversationId: string;
        memberId: string;
        bannedUntil?: string | null;
      }>
    ) => {
      const conv = state.conversations.find((c) => c._id === action.payload.conversationId);
      if (conv) {
        const p = conv.participants.find((pp) => pp.userId === action.payload.memberId);
        if (p) {
          (p as any).isBanned = true;
          (p as any).bannedUntil = action.payload.bannedUntil ?? null;
        }
      }
    },
    socketMemberUnbanned: (
      state,
      action: PayloadAction<{ conversationId: string; memberId: string }>
    ) => {
      const conv = state.conversations.find((c) => c._id === action.payload.conversationId);
      if (conv) {
        const p = conv.participants.find((pp) => pp.userId === action.payload.memberId);
        if (p) {
          (p as any).isBanned = false;
          (p as any).bannedUntil = null;
        }
      }
    },

    // ── Join Approval reducers ───────────────────────────────────────
    socketGroupJoinRequested: (
      state,
      action: PayloadAction<{
        conversationId: string;
        requesterId: string;
        requestedAt: string;
      }>
    ) => {
      const { conversationId, requesterId, requestedAt } = action.payload;
      if (!state.pendingJoinRequests[conversationId]) {
        state.pendingJoinRequests[conversationId] = [];
      }
      const already = state.pendingJoinRequests[conversationId].some(
        (r) => r.userId === requesterId
      );
      if (!already) {
        state.pendingJoinRequests[conversationId].push({ userId: requesterId, requestedAt });
      }
    },
    socketGroupJoinApproved: (
      state,
      action: PayloadAction<{
        conversationId: string;
        requesterId: string;
        allParticipantIds: string[];
      }>
    ) => {
      const { conversationId, requesterId } = action.payload;
      // Remove from pending list
      if (state.pendingJoinRequests[conversationId]) {
        state.pendingJoinRequests[conversationId] = state.pendingJoinRequests[
          conversationId
        ].filter((r) => r.userId !== requesterId);
      }
      // Add requester to conversation participants
      const conv = state.conversations.find((c) => c._id === conversationId);
      if (conv && !conv.participants.some((p) => p.userId === requesterId)) {
        conv.participants.push({
          userId: requesterId,
          role: 'member',
          joinedAt: new Date().toISOString(),
        });
      }
    },
    socketGroupJoinDeclined: (
      state,
      action: PayloadAction<{ conversationId: string; requesterId: string }>
    ) => {
      const { conversationId, requesterId } = action.payload;
      if (state.pendingJoinRequests[conversationId]) {
        state.pendingJoinRequests[conversationId] = state.pendingJoinRequests[
          conversationId
        ].filter((r) => r.userId !== requesterId);
      }
    },
    setPendingJoinRequests: (
      state,
      action: PayloadAction<{ conversationId: string; requests: PendingMember[] }>
    ) => {
      state.pendingJoinRequests[action.payload.conversationId] = action.payload.requests;
    },

    // ── Presence reducers ────────────────────────────────────────────
    setUserOnline: (state, action: PayloadAction<{ userId: string }>) => {
      state.userPresence[action.payload.userId] = { online: true };
    },
    setUserOffline: (state, action: PayloadAction<{ userId: string; lastSeen: string }>) => {
      state.userPresence[action.payload.userId] = {
        online: false,
        lastSeen: action.payload.lastSeen,
      };
    },
    setPresenceBatch: (state, action: PayloadAction<Record<string, PresenceInfo>>) => {
      Object.assign(state.userPresence, action.payload);
    },
  },
  extraReducers: (builder) => {
    // fetchConversations
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loadingConversations = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload.conversations;
        // Initialise unread counts; preserve higher socket-incremented values
        for (const [id, count] of Object.entries(action.payload.unreadCounts)) {
          if ((state.unreadCounts[id] ?? 0) < count) {
            state.unreadCounts[id] = count;
          }
        }
        state.loadingConversations = false;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loadingConversations = false;
        state.error = action.payload ?? null;
      });

    // createConversation
    builder.addCase(createConversation.fulfilled, (state, action) => {
      const exists = state.conversations.some((c) => c._id === action.payload._id);
      if (!exists) state.conversations.unshift(action.payload);
      // Do NOT set activeConversationId here — callers call navigate() which
      // triggers ChatPage's useEffect to set it from the URL (single source of truth)
    });

    // fetchMessages
    builder
      .addCase(fetchMessages.pending, (state) => {
        state.loadingMessages = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { conversationId, messages, hasMore } = action.payload;
        const existing = state.messages[conversationId] ?? [];
        const existingIds = new Set(existing.map((m) => m._id));
        const fetchedMap = new Map(messages.map((m) => [m._id, m]));

        // Update existing messages that now have metadata (e.g. reminder_created socket arrived without metadata)
        const updated = existing.map((m) => {
          const fresh = fetchedMap.get(m._id);
          if (fresh && fresh.metadata && !m.metadata) return { ...m, metadata: fresh.metadata };
          return m;
        });

        // Prepend older messages before existing (pagination scrolls up to load older)
        const newMsgs = messages.filter((m) => !existingIds.has(m._id)).reverse();
        state.messages[conversationId] = [...newMsgs, ...updated];
        state.hasMore[conversationId] = hasMore;
        state.loadingMessages = false;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loadingMessages = false;
        state.error = action.payload ?? null;
      });

    // sendMessage
    builder
      .addCase(sendMessage.pending, (state) => {
        state.sendingMessage = true;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sendingMessage = false;
        const msg = action.payload;
        // Use the thunk arg's conversationId (guaranteed correct string) instead of
        // msg.conversationId from API which may be an ObjectId object when unserialised
        const convId = action.meta.arg.conversationId;
        if (!state.messages[convId]) state.messages[convId] = [];
        const exists = state.messages[convId].some((m) => m._id === msg._id);
        if (!exists) state.messages[convId].push(msg);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.sendingMessage = false;
        state.error = action.payload ?? null;
      });

    // revokeMessage
    builder.addCase(revokeMessage.fulfilled, (state, action) => {
      const { messageId, conversationId } = action.payload;
      const msgs = state.messages[conversationId];
      if (msgs) {
        const msg = msgs.find((m) => m._id === messageId);
        if (msg) {
          msg.revokedAt = new Date().toISOString();
        }
      }
      // Update lastMessage preview if this was the last message
      const conv = state.conversations.find((c) => c._id === conversationId);
      if (conv?.lastMessage) {
        const msgs2 = state.messages[conversationId];
        const isLast = msgs2 && msgs2.length > 0 && msgs2[msgs2.length - 1]?._id === messageId;
        if (isLast) {
          conv.lastMessage = { ...conv.lastMessage, revokedAt: new Date().toISOString() };
        }
      }
    });

    // deleteMessage
    builder.addCase(deleteMessage.fulfilled, (state, action) => {
      const { messageId, conversationId } = action.payload;
      const msgs = state.messages[conversationId];
      if (msgs) {
        state.messages[conversationId] = msgs.filter((m) => m._id !== messageId);
      }
    });

    // forwardMessage
    builder.addCase(forwardMessage.fulfilled, (state, action) => {
      const msg = action.payload;
      const convId = msg.conversationId;
      if (!state.messages[convId]) state.messages[convId] = [];
      // Dedup: socket may deliver the same message before the thunk resolves
      if (!state.messages[convId].some((m) => m._id === msg._id)) {
        state.messages[convId].push(msg);
      }
    });

    // ── Group thunk reducers ──────────────────────────────────────────
    builder.addCase(addGroupMembers.fulfilled, (state, action) => {
      // pending case: no conversation update needed (socket will handle approved)
      // direct add case: socket group:members_added handles update
    });

    builder.addCase(removeGroupMember.fulfilled, (state, action) => {
      const updated = action.payload;
      const idx = state.conversations.findIndex((c) => c._id === updated._id);
      if (idx >= 0) state.conversations[idx] = { ...state.conversations[idx], ...updated };
    });

    builder.addCase(leaveGroup.fulfilled, (state, action) => {
      const { conversationId } = action.payload;
      state.conversations = state.conversations.filter((c) => c._id !== conversationId);
      delete state.messages[conversationId];
      delete state.hasMore[conversationId];
      if (state.activeConversationId === conversationId) {
        state.activeConversationId = null;
      }
    });

    builder.addCase(updateGroup.fulfilled, (state, action) => {
      const updated = action.payload;
      const idx = state.conversations.findIndex((c) => c._id === updated._id);
      if (idx >= 0) state.conversations[idx] = { ...state.conversations[idx], ...updated };
    });

    builder.addCase(dissolveGroup.fulfilled, (state, action) => {
      const { conversationId } = action.payload;
      state.conversations = state.conversations.filter((c) => c._id !== conversationId);
      delete state.messages[conversationId];
      delete state.hasMore[conversationId];
      if (state.activeConversationId === conversationId) {
        state.activeConversationId = null;
      }
    });

    // fetchGroupMemberProfiles
    builder.addCase(fetchGroupMemberProfiles.fulfilled, (state, action) => {
      for (const profile of action.payload) {
        state.groupMemberProfiles[profile.id] = profile;
      }
    });

    // editMessage
    builder.addCase(editMessage.fulfilled, (state, action) => {
      const msg = action.payload;
      const convId = action.meta.arg.conversationId;
      const msgs = state.messages[convId];
      if (msgs) {
        const idx = msgs.findIndex((m) => m._id === msg._id);
        if (idx >= 0) msgs[idx] = { ...msgs[idx], ...msg };
      }
    });

    // fetchPinnedMessages
    builder.addCase(fetchPinnedMessages.fulfilled, (state, action) => {
      const { conversationId, messages } = action.payload;
      state.pinnedMessages[conversationId] = messages;
    });

    // updateGroupSettings — optimistically update local state immediately
    builder.addCase(updateGroupSettings.fulfilled, (state, action) => {
      const { conversationId, settings } = action.payload;
      const conv = state.conversations.find((c) => c._id === conversationId);
      if (conv) {
        conv.settings = { ...conv.settings, ...settings } as any;
      }
    });
  },
});

export const {
  setActiveConversation,
  clearChatError,
  socketMessageNew,
  socketMessageRevoked,
  socketMessageRestored,
  socketMessageEdited,
  socketMessagePinned,
  socketMessageUnpinned,
  socketTypingUpdate,
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
  setPendingJoinRequests,
  socketPollUpdated,
  socketPollDeleted,
  setUserOnline,
  setUserOffline,
  setPresenceBatch,
} = chatSlice.actions;

export default chatSlice.reducer;
