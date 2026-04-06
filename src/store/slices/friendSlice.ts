import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { friendServices } from '@/services/friendServices';
import type { FriendItem, FriendRequest, SentRequest } from '@/types/friend.type';

export interface FriendState {
  friends: FriendItem[];
  receivedRequests: FriendRequest[];
  sentRequests: SentRequest[];
  loadingFriends: boolean;
  loadingRequests: boolean;
  error: string | null;
}

const initialState: FriendState = {
  friends: [],
  receivedRequests: [],
  sentRequests: [],
  loadingFriends: false,
  loadingRequests: false,
  error: null,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchFriends = createAsyncThunk<FriendItem[], void, { rejectValue: string }>(
  'friend/fetchFriends',
  async (_, thunkAPI) => {
    try {
      return await friendServices.getFriends();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message ?? 'Không thể tải danh sách bạn bè');
    }
  }
);

export const fetchReceivedRequests = createAsyncThunk<
  FriendRequest[],
  void,
  { rejectValue: string }
>('friend/fetchReceivedRequests', async (_, thunkAPI) => {
  try {
    return await friendServices.getReceivedRequests();
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.message ?? 'Không thể tải lời mời kết bạn');
  }
});

export const fetchSentRequests = createAsyncThunk<SentRequest[], void, { rejectValue: string }>(
  'friend/fetchSentRequests',
  async (_, thunkAPI) => {
    try {
      return await friendServices.getSentRequests();
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message ?? 'Không thể tải lời mời đã gửi');
    }
  }
);

export const sendFriendRequest = createAsyncThunk<void, string, { rejectValue: string }>(
  'friend/sendRequest',
  async (addresseeId, thunkAPI) => {
    try {
      await friendServices.sendRequest(addresseeId);
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err.response?.data?.message ?? err.message ?? 'Không thể gửi lời mời'
      );
    }
  }
);

export const acceptFriendRequest = createAsyncThunk<string, string, { rejectValue: string }>(
  'friend/acceptRequest',
  async (friendshipId, thunkAPI) => {
    try {
      await friendServices.acceptRequest(friendshipId);
      return friendshipId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data?.message ?? 'Không thể chấp nhận lời mời');
    }
  }
);

export const declineFriendRequest = createAsyncThunk<string, string, { rejectValue: string }>(
  'friend/declineRequest',
  async (friendshipId, thunkAPI) => {
    try {
      await friendServices.declineRequest(friendshipId);
      return friendshipId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data?.message ?? 'Không thể từ chối lời mời');
    }
  }
);

export const cancelFriendRequest = createAsyncThunk<string, string, { rejectValue: string }>(
  'friend/cancelRequest',
  async (friendshipId, thunkAPI) => {
    try {
      await friendServices.cancelRequest(friendshipId);
      return friendshipId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data?.message ?? 'Không thể hủy lời mời');
    }
  }
);

export const unfriendUser = createAsyncThunk<string, string, { rejectValue: string }>(
  'friend/unfriend',
  async (friendId, thunkAPI) => {
    try {
      await friendServices.unfriend(friendId);
      return friendId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data?.message ?? 'Không thể xóa bạn bè');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const friendSlice = createSlice({
  name: 'friend',
  initialState,
  reducers: {
    clearFriendError: (state) => {
      state.error = null;
    },
    // Socket event: new friend request received for the current user
    socketRequestReceived: (state, action: { payload: FriendRequest }) => {
      const exists = state.receivedRequests.some(
        (r) => r.friendshipId === action.payload.friendshipId
      );
      if (!exists) {
        state.receivedRequests.unshift(action.payload);
      }
    },
    // Socket event: one of this user's sent requests was accepted
    socketRequestAccepted: (state, action: { payload: { friendshipId: string } }) => {
      state.sentRequests = state.sentRequests.filter(
        (r) => r.friendshipId !== action.payload.friendshipId
      );
      state.receivedRequests = state.receivedRequests.filter(
        (r) => r.friendshipId !== action.payload.friendshipId
      );
    },
    // Socket event: one of this user's sent requests was declined
    socketRequestDeclined: (state, action: { payload: { friendshipId: string } }) => {
      state.sentRequests = state.sentRequests.filter(
        (r) => r.friendshipId !== action.payload.friendshipId
      );
    },
    // Socket event: a pending request sent to the current user was cancelled
    socketRequestCancelled: (state, action: { payload: { friendshipId: string } }) => {
      state.receivedRequests = state.receivedRequests.filter(
        (r) => r.friendshipId !== action.payload.friendshipId
      );
    },
    // Socket event: a friendship was dissolved (affects both sides)
    socketUnfriended: (state, action: { payload: { userId: string; formerFriendId: string } }) => {
      const { userId, formerFriendId } = action.payload;
      state.friends = state.friends.filter(
        (f) => f.user.id !== userId && f.user.id !== formerFriendId
      );
    },
  },
  extraReducers: (builder) => {
    // fetchFriends
    builder
      .addCase(fetchFriends.pending, (state) => {
        state.loadingFriends = true;
        state.error = null;
      })
      .addCase(fetchFriends.fulfilled, (state, action) => {
        state.friends = action.payload;
        state.loadingFriends = false;
      })
      .addCase(fetchFriends.rejected, (state, action) => {
        state.loadingFriends = false;
        state.error = action.payload ?? null;
      });

    // fetchReceivedRequests
    builder
      .addCase(fetchReceivedRequests.pending, (state) => {
        state.loadingRequests = true;
      })
      .addCase(fetchReceivedRequests.fulfilled, (state, action) => {
        state.receivedRequests = action.payload;
        state.loadingRequests = false;
      })
      .addCase(fetchReceivedRequests.rejected, (state, action) => {
        state.loadingRequests = false;
        state.error = action.payload ?? null;
      });

    // fetchSentRequests
    builder
      .addCase(fetchSentRequests.pending, (state) => {
        state.loadingRequests = true;
      })
      .addCase(fetchSentRequests.fulfilled, (state, action) => {
        state.sentRequests = action.payload;
        state.loadingRequests = false;
      })
      .addCase(fetchSentRequests.rejected, (state, action) => {
        state.loadingRequests = false;
        state.error = action.payload ?? null;
      });

    // acceptFriendRequest — remove from receivedRequests, refresh friends
    builder.addCase(acceptFriendRequest.fulfilled, (state, action) => {
      state.receivedRequests = state.receivedRequests.filter(
        (r) => r.friendshipId !== action.payload
      );
    });

    // declineFriendRequest — remove from receivedRequests
    builder.addCase(declineFriendRequest.fulfilled, (state, action) => {
      state.receivedRequests = state.receivedRequests.filter(
        (r) => r.friendshipId !== action.payload
      );
    });

    // cancelFriendRequest — remove from sentRequests
    builder.addCase(cancelFriendRequest.fulfilled, (state, action) => {
      state.sentRequests = state.sentRequests.filter((r) => r.friendshipId !== action.payload);
    });

    // unfriendUser — remove from friends list
    builder.addCase(unfriendUser.fulfilled, (state, action) => {
      state.friends = state.friends.filter((f) => f.user.id !== action.payload);
    });
  },
});

export const {
  clearFriendError,
  socketRequestReceived,
  socketRequestAccepted,
  socketRequestDeclined,
  socketRequestCancelled,
  socketUnfriended,
} = friendSlice.actions;
export default friendSlice.reducer;
