import { MessageCircle, Mail, Calendar } from 'lucide-react';
import type { FriendItem } from '@/types/friend.type';
import UserAvatar from '@/components/UserAvatar';

interface FriendProfilePanelProps {
  item: FriendItem | null;
}

export default function FriendProfilePanel({ item }: FriendProfilePanelProps) {
  if (!item) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5] select-none">
        <div className="w-20 h-20 bg-[#0068FF]/10 rounded-full flex items-center justify-center mb-5">
          <MessageCircle className="w-10 h-10 text-[#0068FF]/50" strokeWidth={1.5} />
        </div>
        <p className="text-[15px] font-semibold text-gray-700 mb-1">Danh bạ</p>
        <p className="text-[13px] text-gray-400">Chọn một người bạn để xem thông tin</p>
      </div>
    );
  }

  const { user, friendSince } = item;
  const friendDate = friendSince
    ? new Date(friendSince).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  return (
    <div className="flex-1 flex flex-col bg-[#F0F2F5] overflow-y-auto">
      {/* Cover + avatar */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-br from-[#0068FF] to-[#00B4DB]" />
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-10">
          <div className="rounded-full border-4 border-white shadow-lg">
            <UserAvatar src={user?.avatar} name={user?.fullName} size={80} variant="medium" />
          </div>
        </div>
      </div>

      {/* Name + actions */}
      <div className="mt-14 text-center px-6 pb-4 border-b border-gray-200 bg-white">
        <h2 className="text-[17px] font-semibold text-gray-800 mb-0.5">
          {user?.fullName || '(Chưa đặt tên)'}
        </h2>
        <p className="text-[13px] text-gray-400 mb-4">{user?.email}</p>

        {/* Action buttons */}
        <div className="flex justify-center gap-3">
          <button
            className="flex flex-col items-center gap-1.5 px-5 py-2.5 bg-[#EBF3FF]
                       rounded-xl hover:bg-[#d8eaff] transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-[#0068FF]" strokeWidth={2} />
            <span className="text-[12px] font-medium text-[#0068FF]">Nhắn tin</span>
          </button>
        </div>
      </div>

      {/* Info section */}
      <div className="bg-white mt-2 mx-0 p-4">
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
              <p className="text-[13px] text-gray-700">{user?.email}</p>
            </div>
          </div>

          {friendDate && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Bạn bè từ</p>
                <p className="text-[13px] text-gray-700">{friendDate}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
