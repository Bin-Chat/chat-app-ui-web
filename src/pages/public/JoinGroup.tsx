import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, Clock, MessageCircle, XCircle } from 'lucide-react';
import { chatServices } from '../../services/chatServices';

type JoinStatus = 'loading' | 'joined' | 'pending' | 'error';

export default function JoinGroup() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<JoinStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [conversationId, setConversationId] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Liên kết mời không hợp lệ.');
      return;
    }

    chatServices
      .joinByToken(token)
      .then((res) => {
        if (res.status === 'joined') {
          setConversationId(res.conversationId);
          setStatus('joined');
          // Auto-redirect after 1.5s
          setTimeout(() => navigate(`/chat/${res.conversationId}`), 1500);
        } else {
          setStatus('pending');
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || 'Liên kết không hợp lệ hoặc đã hết hạn.';
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      {/* Logo */}
      <div className="w-16 h-16 bg-[#0068FF] rounded-[18px] flex items-center justify-center mb-8 shadow-[0_4px_16px_rgba(0,104,255,0.3)]">
        <MessageCircle className="w-9 h-9 text-white" strokeWidth={2.5} />
      </div>

      {status === 'loading' && (
        <>
          <div className="w-10 h-10 border-4 border-[#0068FF] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 text-sm">Đang xử lý liên kết mời…</p>
        </>
      )}

      {status === 'joined' && (
        <>
          <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Tham gia thành công!</h2>
          <p className="text-gray-500 text-sm mb-6">Đang chuyển hướng đến cuộc trò chuyện…</p>
          <button
            onClick={() => navigate(`/chat/${conversationId}`)}
            className="px-6 py-2.5 bg-[#0068FF] hover:bg-[#0052CC] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Vào ngay
          </button>
        </>
      )}

      {status === 'pending' && (
        <>
          <Clock className="w-12 h-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Yêu cầu đã được gửi</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-xs">
            Yêu cầu tham gia nhóm của bạn đang chờ Admin phê duyệt. Bạn sẽ nhận được thông báo khi
            được chấp thuận.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-[#0068FF] hover:bg-[#0052CC] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Về trang chủ
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Không thể tham gia nhóm</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-xs">{errorMsg}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-[#0068FF] hover:bg-[#0052CC] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Về trang chủ
          </button>
        </>
      )}
    </div>
  );
}
