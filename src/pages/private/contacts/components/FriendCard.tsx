import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MoreHorizontal, UserMinus } from 'lucide-react';
import { toast } from 'react-toastify';

import { useAppDispatch } from '@/hooks/useRedux';
import { unfriendUser, fetchFriends, createConversation } from '@/store/slices';
import type { FriendItem } from '@/types/friend.type';
import UserAvatar from '@/components/UserAvatar';

interface FriendCardProps {
  item: FriendItem;
  isSelected: boolean;
  onClick: () => void;
}

export default function FriendCard({ item, isSelected, onClick }: FriendCardProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { user } = item;

  const handleChat = async () => {
    try {
      const conv = await dispatch(createConversation({ participantIds: [user.id] })).unwrap();
      navigate(`/chat/${conv._id}`);
    } catch (err: any) {
      toast.error(err ?? 'Không thể mở hội thoại');
    }
  };

  const handleUnfriend = async () => {
    setConfirming(false);
    try {
      await dispatch(unfriendUser(user.id)).unwrap();
      dispatch(fetchFriends());
      toast.success(`Đã xóa ${user.fullName} khỏi danh sách bạn bè`);
    } catch (err: any) {
      toast.error(err ?? 'Không thể xóa bạn bè');
    }
  };

  return (
    <>
      <li
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors relative group
          ${isSelected ? 'bg-[#EBF3FF]' : 'hover:bg-gray-50'}`}
      >
        {/* Avatar */}
        <UserAvatar src={user?.avatar} name={user?.fullName} size={40} online />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-800 truncate">
            {user?.fullName || '(Chưa đặt tên)'}
          </p>
          <p className="text-[12px] text-gray-400 truncate">{user?.email}</p>
        </div>

        {/* Actions — visible on hover */}
        <div
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            title="Nhắn tin"
            onClick={handleChat}
            className="w-7 h-7 rounded-lg flex items-center justify-center
                       text-gray-400 hover:bg-[#EBF3FF] hover:text-[#0068FF] transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
          <button
            title="Tùy chọn"
            onClick={() => setShowMenu((v) => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center
                       text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors relative"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />

            {/* Dropdown */}
            <AnimatePresence>
              {showMenu && (
                <motion.ul
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-8 z-20 w-44 bg-white rounded-xl shadow-lg
                             border border-gray-100 overflow-hidden py-1"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  <li>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setConfirming(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px]
                                 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      Xóa bạn bè
                    </button>
                  </li>
                </motion.ul>
              )}
            </AnimatePresence>
          </button>
        </div>
      </li>

      {/* Confirm unfriend dialog */}
      <AnimatePresence>
        {confirming && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
              onClick={() => setConfirming(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.16 }}
                className="pointer-events-auto w-[320px] bg-white rounded-2xl shadow-xl p-6"
              >
                <p className="text-[15px] font-semibold text-gray-800 mb-1">Xóa bạn bè?</p>
                <p className="text-[13px] text-gray-500 mb-5">
                  Bạn có chắc muốn xóa <span className="font-medium">{user?.fullName}</span> khỏi
                  danh sách bạn bè không?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="flex-1 py-2 text-[13px] font-medium text-gray-600 bg-gray-100
                               rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleUnfriend}
                    className="flex-1 py-2 text-[13px] font-medium text-white bg-red-500
                               rounded-xl hover:bg-red-600 transition-colors"
                  >
                    Xóa
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
