import { MessageCircle } from 'lucide-react';

export function ChatWelcome() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5] select-none px-6 text-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0068FF]/10 rounded-full flex items-center justify-center mb-4 sm:mb-5">
        <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-[#0068FF]/60" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-semibold text-gray-700 mb-1">Chào mừng đến Bin Chat</p>
      <p className="text-[13px] text-gray-400">Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
    </div>
  );
}
