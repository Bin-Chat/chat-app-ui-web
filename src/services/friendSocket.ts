import { io, Socket } from 'socket.io-client';

type FriendEventPayload = {
  friendshipId?: string;
  requesterId?: string;
  addresseeId?: string;
  sentAt?: string;
  acceptedAt?: string;
  userId?: string;
  formerFriendId?: string;
};

type FriendEventName =
  | 'friend:request_received'
  | 'friend:request_accepted'
  | 'friend:request_declined'
  | 'friend:request_cancelled'
  | 'friend:unfriended';

type EventCallback = (payload: FriendEventPayload) => void;

let socket: Socket | null = null;

export const friendSocket = {
  connect(userId: string) {
    if (socket?.connected) return;

    socket = io(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '/', {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[friendSocket] connected:', socket?.id);
      socket?.emit('join', { userId });
    });

    socket.on('disconnect', (reason) => {
      console.log('[friendSocket] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[friendSocket] connection error:', err.message);
    });
  },

  disconnect() {
    socket?.disconnect();
    socket = null;
  },

  on(event: FriendEventName, callback: EventCallback) {
    socket?.on(event, callback);
  },

  off(event: FriendEventName, callback?: EventCallback) {
    socket?.off(event, callback);
  },

  isConnected(): boolean {
    return socket?.connected ?? false;
  },
};
