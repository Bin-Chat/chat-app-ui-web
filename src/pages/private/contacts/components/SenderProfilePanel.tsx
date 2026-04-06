import { useState } from 'react';
import { Check, X, Loader2, Mail, Calendar, MessageCircle, BookOpen } from 'lucide-react';
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

interface SenderProfilePanelProps {
  item: FriendRequest | null;
}

export default function SenderProfilePanel({ item }: SenderProfilePanelProps) {
  const dispatch = useAppDispatch();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  if (!item) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5] select-none">
        <div className="w-20 h-20 bg-[#0068FF]/10 rounded-full flex items-center justify-center mb-5">
          <MessageCircle className="w-10 h-10 text-[#0068FF]/50" strokeWidth={1.5} />
        </div>
        <p className="text-[15px] font-semibold text-gray-700 mb-1">Lời mời kết bạn</p>
        <p className="text-[13px] text-gray-400">Chọn một lời mời để xem thông tin</p>
      </div>
    );
  }

  const { sender, sentAt, friendshipId } = item;

  const sentDate = sentAt
    ? new Date(sentAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await dispatch(acceptFriendRequest(friendshipId)).unwrap();
      await Promise.all([dispatch(fetchFriends()), dispatch(fetchReceivedRequests())]);
      toast.success(`Đã chấp nhận lời mời từ ${sender?.fullName}`);
    } catch (err: unknown) {
      toast.error(typeof err === 'string' ? err : 'Không thể chấp nhận lời mời');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await dispatch(declineFriendRequest(friendshipId)).unwrap();
      await dispatch(fetchReceivedRequests());
      toast.info(`Đã từ chối lời mời từ ${sender?.fullName}`);
    } catch (err: unknown) {
      toast.error(typeof err === 'string' ? err : 'Không thể từ chối lời mời');
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F0F2F5] overflow-y-auto">
      {/* Cover + avatar */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-br from-[#0068FF] to-[#00B4DB]" />
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-10">
          <div className="rounded-full border-4 border-white shadow-lg">
            <UserAvatar src={sender?.avatar} name={sender?.fullName} size={80} variant="medium" />
          </div>
        </div>
      </div>

      {/* Name + actions */}
      <div className="mt-14 text-center px-6 pb-4 border-b border-gray-200 bg-white">
        <h2 className="text-[17px] font-semibold text-gray-800 mb-0.5">
          {sender?.fullName || '(Chưa đặt tên)'}
        </h2>
        <p className="text-[13px] text-gray-400 mb-4">{sender?.email}</p>

        {/* Action buttons */}
        <div className="flex justify-center gap-3">
          <button
            onClick={handleAccept}
            disabled={accepting || declining}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0068FF] text-white text-[13px]
                       font-medium rounded-xl hover:bg-[#0055d4] disabled:opacity-60 transition-colors"
          >
            {accepting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Đồng ý
          </button>
          <button
            onClick={handleDecline}
            disabled={accepting || declining}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-100 text-gray-600 text-[13px]
                       font-medium rounded-xl hover:bg-red-50 hover:text-red-500 disabled:opacity-60
                       transition-colors"
          >
            {declining ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Từ chối
          </button>
        </div>
      </div>

      {/* Info section */}
      <div className="bg-white mt-2 p-4">
        <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Thông tin cá nhân
        </h3>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Email</p>
              <p className="text-[13px] text-gray-700">{sender?.email}</p>
            </div>
          </div>

          {sentDate && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Đã gửi lời mời</p>
                <p className="text-[13px] text-gray-700">{sentDate}</p>
              </div>
            </div>
          )}

          {sender?.bio && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <BookOpen className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Giới thiệu</p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{sender.bio}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
