import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2, User } from 'lucide-react';
import { aiServices } from '@/services/aiServices';
import { toast } from 'react-toastify';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiBotPanelProps {
  onClose: () => void;
}

export default function AiBotPanel({ onClose }: AiBotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Xin chào! Tôi là BinChat AI. Tôi có thể trả lời câu hỏi dựa trên tài liệu đã được lưu trữ. Hãy hỏi tôi bất cứ điều gì!',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await aiServices.ask(q);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer }]);
    } catch {
      toast.error('Không thể kết nối AI. Vui lòng thử lại.');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Xin lỗi, tôi gặp sự cố. Vui lòng thử lại sau.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col w-full h-full bg-white border-l border-gray-100 shadow-sm md:relative md:inset-auto md:z-auto md:w-[340px]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#0068FF]/5 to-transparent">
        <div className="w-8 h-8 rounded-full bg-[#0068FF] flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-gray-800">BinChat AI</p>
          <p className="text-[11px] text-green-500">Đang hoạt động</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-100">
              {msg.role === 'assistant' ? (
                <Bot className="w-4 h-4 text-[#0068FF]" />
              ) : (
                <User className="w-4 h-4 text-gray-500" />
              )}
            </div>
            <div
              className={`max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#0068FF] text-white rounded-tr-sm'
                  : 'bg-gray-100 text-gray-700 rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-100">
              <Bot className="w-4 h-4 text-[#0068FF]" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi AI về tài liệu..."
            className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder-gray-400 outline-none"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-7 h-7 rounded-full bg-[#0068FF] flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#005CE6] transition-colors"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400 text-center">
          Dựa trên tài liệu đã index · RAG Technology
        </p>
      </div>
    </div>
  );
}
