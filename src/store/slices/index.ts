// Export all slices from a centralized location

export { default as authReducer } from './authSlice';
// Export named auth actions and thunks (tránh TS4094 với export *)
export {
  fetchProfile,
  logoutUser,
  updateProfile,
  setIsLogging,
  setUser,
  setAuth,
  forceLogout,
} from './authSlice';
export type { AuthState } from './authSlice';

export { default as friendReducer } from './friendSlice';
export {
  fetchFriends,
  fetchReceivedRequests,
  fetchSentRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  unfriendUser,
  clearFriendError,
  socketRequestReceived,
  socketRequestAccepted,
  socketRequestDeclined,
  socketRequestCancelled,
  socketUnfriended,
} from './friendSlice';
export type { FriendState } from './friendSlice';

export { default as chatReducer } from './chatSlice';
export {
  fetchConversations,
  createConversation,
  fetchMessages,
  sendMessage,
  revokeMessage,
  deleteMessage,
  forwardMessage,
  reactToMessage,
  fetchGroupMembers,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  updateGroup,
  changeGroupRole,
  transferGroupOwnership,
  dissolveGroup,
  fetchGroupMemberProfiles,
  setActiveConversation,
  clearChatError,
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
  setUserOnline,
  setUserOffline,
  setPresenceBatch,
  editMessage,
  pinMessage,
  unpinMessage,
  fetchPinnedMessages,
  updateGroupSettings,
  banGroupMember,
  unbanGroupMember,
  socketMessageEdited,
  socketMessagePinned,
  socketMessageUnpinned,
  socketTypingUpdate,
} from './chatSlice';
export type { ChatState, PresenceInfo } from './chatSlice';

export { default as callReducer } from './callSlice';
export {
  setIncomingCall,
  clearIncomingCall,
  startCall,
  acceptCall,
  setCallConnected,
  addParticipant,
  removeParticipant,
  endCall,
  setMuted,
  setVideoOff,
  setScreenSharing,
  setOngoingGroupCall,
} from './callSlice';
export type { IncomingCallInfo, CallStatus, CallSliceState } from './callSlice';
