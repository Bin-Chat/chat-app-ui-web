import { Check, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';

import { useAppDispatch } from '@/hooks/useRedux';
import UserAvatar from '@/components/UserAvatar';
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchReceivedRequests,
} from '@/store/slices';
import type { FriendRequest } from '@/types/friend.type';

interface ReceivedRequestCardProps {
  item: FriendRequest;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function ReceivedRequestCard({
  item,
  isSelected,
  onSelect,
}: ReceivedRequestCardProps) {
  const dispatch = useAppDispatch();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const { sender } = item;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await dispatch(acceptFriendRequest(item.friendshipId)).unwrap();
      await dispatch(fetchFriends());
      await dispatch(fetchReceivedRequests());
      toast.success(`Đã chấp nhận lời mời từ ${sender?.fullName}`);
    } catch (err: any) {
      toast.error(err ?? 'Không thể chấp nhận lời mời');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await dispatch(declineFriendRequest(item.friendshipId)).unwrap();
      await dispatch(fetchReceivedRequests());
      toast.info(`Đã từ chối lời mời từ ${sender?.fullName}`);
    } catch (err: any) {
      toast.error(err ?? 'Không thể từ chối lời mời');
    } finally {
      setDeclining(false);
    }
  };

  return (
    <li
      onClick={onSelect}
      className={`px-3 py-2.5 rounded-xl transition-colors ${
        onSelect ? 'cursor-pointer' : ''
      } ${isSelected ? 'bg-[#EBF3FF]' : 'hover:bg-gray-50'}`}
    >
      {/* Row 1: Avatar + Info */}
      <div className="flex items-center gap-3">
        <UserAvatar src={sender?.avatar} name={sender?.fullName} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-800 truncate">
            {sender?.fullName || '(Chưa đặt tên)'}
          </p>
          <p className="text-[12px] text-gray-400 truncate">{sender?.email}</p>
        </div>
      </div>

      {/* Row 2: Actions (indented to align with text) */}
      <div className="flex items-center gap-2 mt-2 pl-[52px]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleAccept}
          disabled={accepting || declining}
          title="Chấp nhận"
          className="flex flex-1 items-center justify-center gap-1 px-3 py-1.5 text-[12px] font-medium
                     bg-blue-50 text-[#0068FF] rounded-lg hover:bg-[#0068FF] hover:text-white
                     disabled:opacity-60 transition-colors"
        >
          {accepting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Đồng ý
        </button>
        <button
          onClick={handleDecline}
          disabled={accepting || declining}
          title="Từ chối"
          className="flex flex-1 items-center justify-center gap-1 px-3 py-1.5 text-[12px] font-medium
                     bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-500
                     disabled:opacity-60 transition-colors"
        >
          {declining ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          Từ chối
        </button>
      </div>
    </li>
  );
}
