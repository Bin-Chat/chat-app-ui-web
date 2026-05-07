import { useState, useRef, useEffect } from 'react';
import { X, Search, Loader2, MessageSquare, RefreshCw, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { aiServices, type SearchResult } from '@/services/aiServices';
import { toast } from 'react-toastify';
import type { Message } from '@/types/chat.type';

interface AiSearchPanelProps {
  conversationId: string;
  onClose: () => void;
  onScrollToMessage?: (messageId: string, timestamp: string) => void;
  /** Current messages in view — used for backfill indexing */
  messages?: Message[];
}

export default function AiSearchPanel({
  conversationId,
  onClose,
  onScrollToMessage,
  messages,
}: AiSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSyncedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Lấy thời gian hiện tại
    const now = new Date();

    // Ép trình duyệt bù trừ đúng múi giờ hiện tại (VD: Việt Nam là +7)
    // và cắt chuỗi lấy định dạng chuẩn 'yyyy-MM-dd' cho input type="date"
    const localDateString = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];

    setToDate(localDateString);
  }, []);
  const buildSyncPayload = () => {
    if (!messages || messages.length === 0)
      return [] as Array<{
        messageId: string;
        conversationId: string;
        senderId: string;
        content: string;
        timestamp: string;
        revokedAt?: string | null;
      }>;

    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toTs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    const source = messages
      .filter((m) => {
        if (!m.content?.trim()) return false;
        if (m.type !== 'text') return false;
        if (m.revokedAt) return false;
        const ts = new Date(m.createdAt).getTime();
        return ts >= fromTs && ts <= toTs;
      })
      .slice(-400); // hard cap for performance

    return source.map((m) => ({
      messageId: m._id,
      conversationId,
      senderId: m.senderId,
      content: m.content!,
      timestamp: m.createdAt,
      revokedAt: m.revokedAt,
    }));
  };

  // Auto-sync on first open (once per mount, limited to last 200 messages)
  useEffect(() => {
    if (autoSyncedRef.current || !messages || messages.length === 0) return;
    autoSyncedRef.current = true;
    const payload = buildSyncPayload().slice(-200);
    if (payload.length === 0) return;
    aiServices.reindexMessages(payload).catch(() => {
      // Silent auto-sync — don't distract user with errors
    });
  }, [conversationId, messages, fromDate, toDate]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(false);
    try {
      const words = q.split(/\s+/).filter(Boolean).length;
      const minScore = words <= 2 ? 0.55 : undefined;
      const res = await aiServices.search(q, conversationId, 20, minScore);
      setResults(res.results);
      setSearched(true);
    } catch {
      toast.error('Tìm kiếm thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!messages || messages.length === 0) return;
    setSyncing(true);
    try {
      const payload = buildSyncPayload();
      if (payload.length === 0) {
        toast.info('Không có tin nhắn phù hợp trong khoảng thời gian đã chọn.');
        return;
      }
      const res = await aiServices.reindexMessages(payload);
      setSynced(true);
      toast.success(`Đã đồng bộ ${res.indexed}/${res.total} tin nhắn vào chỉ mục tìm kiếm.`);
      setTimeout(() => setSynced(false), 5000);
    } catch {
      toast.error('Đồng bộ thất bại. Vui lòng thử lại.');
    } finally {
      setSyncing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="flex flex-col w-[340px] h-full bg-white border-l border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Search className="w-4 h-4 text-[#0068FF]" />
        <span className="text-[14px] font-semibold text-gray-800 flex-1">Tìm kiếm thông minh</span>
        {messages && messages.length > 0 && (
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Đồng bộ tin nhắn vào chỉ mục tìm kiếm"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-blue-50 text-gray-400 hover:text-[#0068FF] transition-colors disabled:opacity-50"
          >
            {synced ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : syncing ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#0068FF]" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        )}
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search input */}
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm theo ý nghĩa, ví dụ: 'hẹn gặp vào tuần tới'..."
            className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder-gray-400 outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-[#0068FF] animate-spin flex-shrink-0" />}
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim() || loading}
          className="mt-2 w-full py-1.5 rounded-xl bg-[#0068FF] text-white text-[13px] font-medium hover:bg-[#005CE6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Tìm kiếm
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 px-2 text-[12px] text-gray-600 outline-none focus:border-[#0068FF]"
            title="Từ ngày"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 px-2 text-[12px] text-gray-600 outline-none focus:border-[#0068FF]"
            title="Đến ngày"
          />
        </div>
        <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
          AI tìm kiếm theo ngữ nghĩa, ưu tiên kết quả sát nghĩa và không hiển thị tin nhắn đã thu
          hồi.
          {messages && messages.length > 0 && (
            <>
              {' '}
              Nhấn <RefreshCw className="w-2.5 h-2.5 inline" /> để đồng bộ theo khoảng ngày (giới
              hạn 400 tin).
            </>
          )}
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <MessageSquare className="w-8 h-8 text-gray-200" />
            <p className="text-[13px] text-gray-400">Không tìm thấy kết quả phù hợp</p>
            {messages && messages.length > 0 && (
              <p className="text-[11px] text-gray-400 text-center px-4">
                Thử nhấn <span className="font-medium">đồng bộ</span> (icon ↻ ở góc trên) rồi tìm
                lại.
              </p>
            )}
          </div>
        )}

        {results.map((r, idx) => (
          <button
            key={idx}
            onClick={() => onScrollToMessage?.(r.messageId, r.timestamp)}
            className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#0068FF] font-medium">
                Độ tương đồng: {Math.round(r.score * 100)}%
              </span>
              <span className="text-[11px] text-gray-400">
                {format(new Date(r.timestamp), 'dd/MM HH:mm')}
              </span>
            </div>
            <p className="text-[13px] text-gray-700 line-clamp-3 leading-relaxed">{r.content}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
