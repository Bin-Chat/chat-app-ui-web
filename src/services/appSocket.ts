import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const appSocket = {
  connect(userId: string) {
    if (socket?.connected) return;

    socket = io(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '/', {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[appSocket] connected:', socket?.id);
      socket?.emit('join', { userId });
    });

    socket.on('disconnect', (reason) => {
      console.log('[appSocket] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[appSocket] connection error:', err.message);
    });
  },

  disconnect() {
    socket?.disconnect();
    socket = null;
  },

  on(event: string, callback: (...args: any[]) => void) {
    socket?.on(event, callback);
  },

  off(event: string, callback?: (...args: any[]) => void) {
    socket?.off(event, callback);
  },

  emit(event: string, ...args: any[]) {
    socket?.emit(event, ...args);
  },

  isConnected(): boolean {
    return socket?.connected ?? false;
  },
};
