import authorizedAxios from '@/utils/authorizedAxios';
import type {
  FriendItem,
  FriendRequest,
  SentRequest,
  BlockedItem,
  FriendshipStatusResult,
} from '@/types/friend.type';

export const friendServices = {
  // ── Friend requests ───────────────────────────────────────────────────────

  sendRequest: (addresseeId: string) =>
    authorizedAxios
      .post('/api/friends/request', { addresseeId })
      .then((r) => r.data),

  acceptRequest: (friendshipId: string) =>
    authorizedAxios
      .patch(`/api/friends/requests/${friendshipId}/accept`)
      .then((r) => r.data),

  declineRequest: (friendshipId: string) =>
    authorizedAxios
      .patch(`/api/friends/requests/${friendshipId}/decline`)
      .then((r) => r.data),

  cancelRequest: (friendshipId: string) =>
    authorizedAxios
      .delete(`/api/friends/requests/${friendshipId}`)
      .then((r) => r.data),

  // ── Friend list ───────────────────────────────────────────────────────────

  getFriends: () =>
    authorizedAxios.get<FriendItem[]>('/api/friends').then((r) => r.data),

  getReceivedRequests: () =>
    authorizedAxios
      .get<FriendRequest[]>('/api/friends/requests/received')
      .then((r) => r.data),

  getSentRequests: () =>
    authorizedAxios
      .get<SentRequest[]>('/api/friends/requests/sent')
      .then((r) => r.data),

  getBlockedUsers: () =>
    authorizedAxios
      .get<BlockedItem[]>('/api/friends/blocked')
      .then((r) => r.data),

  unfriend: (friendId: string) =>
    authorizedAxios.delete(`/api/friends/${friendId}`).then((r) => r.data),

  // ── Block ─────────────────────────────────────────────────────────────────

  blockUser: (userId: string) =>
    authorizedAxios.post(`/api/friends/block/${userId}`).then((r) => r.data),

  unblockUser: (userId: string) =>
    authorizedAxios.delete(`/api/friends/block/${userId}`).then((r) => r.data),

  // ── Status ────────────────────────────────────────────────────────────────

  checkStatus: (userId: string) =>
    authorizedAxios
      .get<FriendshipStatusResult>(`/api/friends/status/${userId}`)
      .then((r) => r.data),

  // ── User search (proxied via user-service) ────────────────────────────────

  searchUsers: (name: string) =>
    authorizedAxios
      .get('/api/users/search', { params: { name } })
      .then((r) => r.data),

  findUserByEmail: (email: string) =>
    authorizedAxios
      .get(`/api/users/email/${encodeURIComponent(email)}`)
      .then((r) => r.data),
};
