import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface IncomingCallInfo {
  callId: string;
  conversationId: string;
  callType: 'audio' | 'video';
  callerId: string;
  callerName: string;
  callerAvatar?: string;
}

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected';

export interface CallState {
  status: CallStatus;
  callId: string | null;
  conversationId: string | null;
  callType: 'audio' | 'video';
  /** IDs of all participants in the current call */
  participantIds: string[];
  initiatorId: string | null;
  incomingCall: IncomingCallInfo | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  /** Non-null when a group call is ongoing but user is not in it (can rejoin) */
  ongoingGroupCall: IncomingCallInfo | null;
}

const initialState: CallState = {
  status: 'idle',
  callId: null,
  conversationId: null,
  callType: 'audio',
  participantIds: [],
  initiatorId: null,
  incomingCall: null,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  ongoingGroupCall: null,
};

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    /** Store an incoming call invitation (only if currently idle) */
    setIncomingCall: (state, action: PayloadAction<IncomingCallInfo>) => {
      if (state.status === 'idle' && !state.incomingCall) {
        state.incomingCall = action.payload;
      }
    },
    clearIncomingCall: (state) => {
      state.incomingCall = null;
    },
    /** Caller side: call has been initiated, waiting for others to pick up */
    startCall: (
      state,
      action: PayloadAction<{
        callId: string;
        conversationId: string;
        callType: 'audio' | 'video';
        participantIds: string[];
        initiatorId: string;
      }>
    ) => {
      state.status = 'calling';
      state.callId = action.payload.callId;
      state.conversationId = action.payload.conversationId;
      state.callType = action.payload.callType;
      state.participantIds = action.payload.participantIds;
      state.initiatorId = action.payload.initiatorId;
      state.incomingCall = null;
      state.isMuted = false;
      state.isVideoOff = action.payload.callType === 'audio';
      state.isScreenSharing = false;
      state.ongoingGroupCall = null;
    },
    acceptCall: (
      state,
      action: PayloadAction<{
        callId: string;
        conversationId: string;
        callType: 'audio' | 'video';
        callerId: string;
        /** ID của người đang accept — để sidebar hiển thị đủ cả 2 bên */
        currentUserId?: string;
      }>
    ) => {
      state.status = 'ringing';
      state.callId = action.payload.callId;
      state.conversationId = action.payload.conversationId;
      state.callType = action.payload.callType;
      const ids = [action.payload.callerId];
      if (action.payload.currentUserId) ids.push(action.payload.currentUserId);
      state.participantIds = ids;
      state.initiatorId = action.payload.callerId;
      state.incomingCall = null;
      state.isMuted = false;
      state.isVideoOff = action.payload.callType === 'audio';
      state.isScreenSharing = false;
      state.ongoingGroupCall = null;
    },
    setCallConnected: (state) => {
      state.status = 'connected';
    },
    addParticipant: (state, action: PayloadAction<string>) => {
      if (!state.participantIds.includes(action.payload)) {
        state.participantIds.push(action.payload);
      }
    },
    removeParticipant: (state, action: PayloadAction<string>) => {
      state.participantIds = state.participantIds.filter((id) => id !== action.payload);
    },
    endCall: (state) => ({ ...initialState, ongoingGroupCall: state.ongoingGroupCall }),
    setMuted: (state, action: PayloadAction<boolean>) => {
      state.isMuted = action.payload;
    },
    setVideoOff: (state, action: PayloadAction<boolean>) => {
      state.isVideoOff = action.payload;
    },
    setScreenSharing: (state, action: PayloadAction<boolean>) => {
      state.isScreenSharing = action.payload;
    },
    setOngoingGroupCall: (state, action: PayloadAction<IncomingCallInfo | null>) => {
      state.ongoingGroupCall = action.payload;
    },
  },
});

export const {
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
} = callSlice.actions;

export default callSlice.reducer;
export type { CallState as CallSliceState };
