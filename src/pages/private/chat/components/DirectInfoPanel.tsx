import { X, Phone, Video } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import MediaInfoPanel from './MediaInfoPanel';
import type { Conversation } from '@/types/chat.type';

interface DirectInfoPanelProps {
  conversation: Conversation;
  onClose: () => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
}

export default function DirectInfoPanel({
  conversation,
  onClose,
  onAudioCall,
  onVideoCall,
}: DirectInfoPanelProps) {
  const other = conversation.otherUser;

  return (
    <div className="w-[320px] h-full bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-[15px] font-bold text-gray-800">Thông tin hội thoại</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* User info */}
        <div className="px-4 py-4 text-center border-b border-gray-100">
          <UserAvatar
            className="m-auto"
            src={other?.avatar}
            name={other?.fullName ?? 'Người dùng'}
            size={64}
          />
          <h4 className="text-[15px] font-bold text-gray-800 mt-2">
            {other?.fullName ?? 'Người dùng'}
          </h4>

          {/* Quick call buttons */}
          <div className="flex items-center justify-center gap-3 mt-3">
            {onAudioCall && (
              <button
                onClick={onAudioCall}
                className="flex flex-col items-center gap-1 w-12"
                title="Gọi thoại"
              >
                <div className="w-9 h-9 rounded-full bg-[#EBF3FF] flex items-center justify-center hover:bg-blue-100 transition-colors">
                  <Phone className="w-4 h-4 text-[#0068FF]" />
                </div>
                <span className="text-[10px] text-gray-500">Thoại</span>
              </button>
            )}
            {onVideoCall && (
              <button
                onClick={onVideoCall}
                className="flex flex-col items-center gap-1 w-12"
                title="Gọi video"
              >
                <div className="w-9 h-9 rounded-full bg-[#EBF3FF] flex items-center justify-center hover:bg-blue-100 transition-colors">
                  <Video className="w-4 h-4 text-[#0068FF]" />
                </div>
                <span className="text-[10px] text-gray-500">Video</span>
              </button>
            )}
          </div>
        </div>

        {/* Media / File / Link sections */}
        <MediaInfoPanel conversationId={conversation._id} />
      </div>
    </div>
  );
}
