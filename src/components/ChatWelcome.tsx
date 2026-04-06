import { MessageCircle } from 'lucide-react';

export function ChatWelcome() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5] select-none">
      <div className="w-20 h-20 bg-[#0068FF]/10 rounded-full flex items-center justify-center mb-5">
        <MessageCircle className="w-10 h-10 text-[#0068FF]/60" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-semibold text-gray-700 mb-1">Chào mừng đến Bin Chat</p>
      <p className="text-[13px] text-gray-400">Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
    </div>
  );
}
