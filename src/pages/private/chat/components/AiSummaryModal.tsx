import { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, FileText, Loader2, Clipboard, Check, Calendar } from 'lucide-react';
import { aiServices, type MessageItem } from '@/services/aiServices';
import type { Message } from '@/types/chat.type';
import { toast } from 'react-toastify';

interface AiSummaryModalProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  messages: Message[];
  members?: { userId: string; fullName?: string }[];
}

function toDateInputValue(d: Date) {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatDateVN(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AiSummaryModal({
  open,
  onClose,
  conversationId,
  messages,
  members = [],
}: AiSummaryModalProps) {
  const today = toDateInputValue(new Date());
  const sevenDaysAgo = toDateInputValue(new Date(Date.now() - 7 * 86400000));

  const [fromDate, setFromDate] = useState(sevenDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resultMeta, setResultMeta] = useState<{ from: string; to: string; count: number } | null>(null);

  // Build name lookup from members
  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    members.forEach((mb) => {
      if (mb.userId && mb.fullName) m[mb.userId] = mb.fullName;
    });
    return m;
  }, [members]);

  // Count eligible messages in the selected date range
  const eligibleCount = useMemo(() => {
    const from = fromDate ? new Date(fromDate).getTime() : 0;
    const to = toDate ? new Date(toDate).getTime() + 86400000 : Infinity;
    return messages.filter((m) => {
      if (m.type !== 'text' || !m.content || m.revokedAt) return false;
      const t = new Date(m.createdAt).getTime();
      return t >= from && t <= to;
    }).length;
  }, [messages, fromDate, toDate]);

  const handleSummarize = async () => {
    if (!fromDate || !toDate) {
      toast.info('Vui lòng chọn khoảng thời gian.');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      toast.info('Ngày bắt đầu phải trước ngày kết thúc.');
      return;
    }

    const from = new Date(fromDate).getTime();
    const to = new Date(toDate).getTime() + 86400000;

    const items: MessageItem[] = messages
      .filter((m) => {
        if (m.type !== 'text' || !m.content || m.revokedAt) return false;
        const t = new Date(m.createdAt).getTime();
        return t >= from && t <= to;
      })
      .map((m) => ({
        senderId: m.senderId,
        senderName: nameMap[m.senderId],
        content: m.content,
        timestamp: m.createdAt,
      }));

    if (items.length < 3) {
      toast.info(`Cần ít nhất 3 tin nhắn trong khoảng thời gian đã chọn (hiện có ${items.length}).`);
      return;
    }

    setLoading(true);
    setSummary(null);
    setResultMeta(null);
    try {
      const res = await aiServices.summarize(conversationId, items, fromDate, toDate);
      setSummary(res.summary);
      setResultMeta({ from: fromDate, to: toDate, count: items.length });
    } catch {
      toast.error('Không thể tóm tắt. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setSummary(null);
      setResultMeta(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl w-[520px] max-w-[95vw] shadow-2xl z-50 focus:outline-none flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#EBF3FF] flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#0068FF]" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-[14px] font-semibold text-gray-800">
                Tóm tắt cuộc trò chuyện
              </Dialog.Title>
              <Dialog.Description className="text-[12px] text-gray-400">
                AI phân tích và tóm tắt nội dung chính theo khoảng thời gian
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Date Range Picker */}
          <div className="px-5 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[12px] text-gray-500 font-medium">Khoảng thời gian</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-gray-400 block mb-1">Từ ngày</label>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || today}
                  onChange={(e) => { setFromDate(e.target.value); setSummary(null); setResultMeta(null); }}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-700 focus:outline-none focus:border-[#0068FF] focus:ring-1 focus:ring-[#0068FF]/20"
                />
              </div>
              <span className="text-gray-300 mt-4">→</span>
              <div className="flex-1">
                <label className="text-[11px] text-gray-400 block mb-1">Đến ngày</label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={today}
                  onChange={(e) => { setToDate(e.target.value); setSummary(null); setResultMeta(null); }}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-700 focus:outline-none focus:border-[#0068FF] focus:ring-1 focus:ring-[#0068FF]/20"
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {eligibleCount > 0
                ? `${eligibleCount} tin nhắn trong khoảng thời gian đã chọn`
                : 'Không có tin nhắn văn bản trong khoảng này'}
            </p>
          </div>

          {/* Body */}
          <div className="px-5 py-4 flex-1 overflow-y-auto min-h-0">
            {!summary && !loading && (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-[#EBF3FF] flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-[#0068FF]" />
                </div>
                <p className="text-[13px] text-gray-500 mb-1">Nhấn "Tóm tắt ngay" để bắt đầu</p>
                <p className="text-[12px] text-gray-400">
                  AI sẽ trích xuất chủ đề, quyết định và nội dung quan trọng
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-[#0068FF] animate-spin" />
                <p className="text-[13px] text-gray-500">Đang phân tích tin nhắn...</p>
              </div>
            )}

            {summary && resultMeta && (
              <div>
                {/* Meta bar */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {formatDateVN(resultMeta.from)} → {formatDateVN(resultMeta.to)}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1">
                    {resultMeta.count} tin nhắn
                  </div>
                </div>

                {/* Summary content */}
                <div className="relative">
                  <div className="bg-gray-50 rounded-xl p-4 text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100">
                    {summary}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg bg-white shadow-sm hover:bg-gray-100 text-gray-400 transition-colors"
                    title="Sao chép"
                  >
                    {copied
                      ? <Check className="w-3.5 h-3.5 text-green-500" />
                      : <Clipboard className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 pb-4 shrink-0">
            <Dialog.Close asChild>
              <button className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors">
                Đóng
              </button>
            </Dialog.Close>
            <button
              onClick={handleSummarize}
              disabled={loading || eligibleCount < 3}
              className="flex-1 py-2 rounded-xl bg-[#0068FF] text-white text-[13px] font-medium hover:bg-[#005CE6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang tóm tắt...
                </>
              ) : summary ? (
                'Tóm tắt lại'
              ) : (
                'Tóm tắt ngay'
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
