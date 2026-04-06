import { useEffect } from 'react';
import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { appSocket } from '@/services/appSocket';
import {
  socketRequestAccepted,
  socketRequestDeclined,
  socketRequestCancelled,
  socketUnfriended,
  fetchReceivedRequests,
  fetchFriends,
} from '@/store/slices';

/**
 * Kết nối Socket.io khi user đăng nhập và lắng nghe các sự kiện friend real-time.
 * Được mount 1 lần trong App.tsx — không render UI.
 */
export function FriendSocketInitializer() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    if (!user) {
      appSocket.disconnect();
      return;
    }

    appSocket.connect(user.id);

    // Initial data load when user becomes available
    dispatch(fetchFriends());
    dispatch(fetchReceivedRequests());

    // Khi nhận lời mời mới: fetch lại để có đầy đủ thông tin sender
    const onRequestReceived = () => {
      toast.info('Bạn có lời mời kết bạn mới');
      dispatch(fetchReceivedRequests());
    };

    // Khi lời mời được chấp nhận:
    // - Chỉ toast cho requester (người đã gửi lời mời)
    // - Fetch lại danh sách bạn để hiện ngay không cần refresh
    const onRequestAccepted = (payload: any) => {
      if (payload.requesterId === user.id) {
        toast.success('Lời mời kết bạn đã được chấp nhận');
      }
      dispatch(socketRequestAccepted(payload));
      dispatch(fetchFriends());
    };

    const onRequestDeclined = (payload: any) => {
      dispatch(socketRequestDeclined(payload));
    };

    const onRequestCancelled = (payload: any) => {
      dispatch(socketRequestCancelled(payload));
    };

    const onUnfriended = (payload: any) => {
      dispatch(socketUnfriended(payload));
    };

    appSocket.on('friend:request_received', onRequestReceived);
    appSocket.on('friend:request_accepted', onRequestAccepted);
    appSocket.on('friend:request_declined', onRequestDeclined);
    appSocket.on('friend:request_cancelled', onRequestCancelled);
    appSocket.on('friend:unfriended', onUnfriended);

    return () => {
      appSocket.off('friend:request_received', onRequestReceived);
      appSocket.off('friend:request_accepted', onRequestAccepted);
      appSocket.off('friend:request_declined', onRequestDeclined);
      appSocket.off('friend:request_cancelled', onRequestCancelled);
      appSocket.off('friend:unfriended', onUnfriended);
    };
  }, [user, dispatch]);

  return null;
}
