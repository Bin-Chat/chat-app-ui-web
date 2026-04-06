import { X, Loader2, Clock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';

import { useAppDispatch } from '@/hooks/useRedux';
import UserAvatar from '@/components/UserAvatar';
import { cancelFriendRequest, fetchSentRequests } from '@/store/slices';
import type { SentRequest } from '@/types/friend.type';

interface SentRequestCardProps {
  item: SentRequest;
}

export default function SentRequestCard({ item }: SentRequestCardProps) {
  const dispatch = useAppDispatch();
  const [cancelling, setCancelling] = useState(false);

  const { addressee } = item;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await dispatch(cancelFriendRequest(item.friendshipId)).unwrap();
      await dispatch(fetchSentRequests());
      toast.info(`Đã hủy lời mời tới ${addressee?.fullName}`);
    } catch (err: any) {
      toast.error(err ?? 'Không thể hủy lời mời');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <li className="px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
      {/* Row 1: Avatar + Info */}
      <div className="flex items-center gap-3">
        <UserAvatar src={addressee?.avatar} name={addressee?.fullName} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-800 truncate">
            {addressee?.fullName || '(Chưa đặt tên)'}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <p className="text-[12px] text-gray-400">Đang chờ xác nhận</p>
          </div>
        </div>
      </div>

      {/* Row 2: Cancel button (indented to align with text) */}
      <div className="mt-2 pl-[52px]">
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="flex w-full items-center justify-center gap-1 px-3 py-1.5 text-[12px] font-medium
                     bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-500
                     disabled:opacity-60 transition-colors"
        >
          {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          Thu hồi
        </button>
      </div>
    </li>
  );
}
