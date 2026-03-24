import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 bg-[#0068FF] rounded-[18px] flex items-center justify-center mb-6 shadow-[0_4px_16px_rgba(0,104,255,0.3)]">
        <MessageCircle className="w-9 h-9 text-white" strokeWidth={2.5} />
      </div>

      <h1 className="text-7xl font-bold text-gray-900 mb-3">404</h1>
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Trang không tồn tại</h2>
      <p className="text-gray-500 text-sm max-w-xs mb-8">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
      </p>

      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#0068FF] hover:bg-[#0052CC]
          text-white text-sm font-semibold rounded-xl transition-all duration-200
          shadow-[0_4px_16px_rgba(0,104,255,0.3)] hover:shadow-[0_6px_20px_rgba(0,104,255,0.4)]"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
