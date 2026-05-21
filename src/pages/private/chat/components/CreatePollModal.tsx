import { useState } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-toastify';
import { chatServices } from '@/services/chatServices';

interface Props {
  conversationId: string;
  onClose: () => void;
  onCreated?: () => void;
}

type ExpiryPreset = 'none' | '1h' | '24h' | '3d' | 'custom';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 20;

export default function CreatePollModal({ conversationId, onClose, onCreated }: Props) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('none');
  const [customExpiry, setCustomExpiry] = useState('');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowAddOptions, setAllowAddOptions] = useState(false);
  const [hideResultsUntilVoted, setHideResultsUntilVoted] = useState(false);
  const [hideVoters, setHideVoters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateOption = (idx: number, val: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
  };

  const addOption = () => {
    if (options.length < MAX_OPTIONS) setOptions((prev) => [...prev, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const computeExpiresAt = (): string | undefined => {
    if (expiryPreset === 'none') return undefined;
    if (expiryPreset === 'custom') {
      if (!customExpiry) return undefined;
      const d = new Date(customExpiry);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    const now = new Date();
    if (expiryPreset === '1h') now.setHours(now.getHours() + 1);
    if (expiryPreset === '24h') now.setHours(now.getHours() + 24);
    if (expiryPreset === '3d') now.setDate(now.getDate() + 3);
    return now.toISOString();
  };

  const validate = (): string | null => {
    const q = question.trim();
    if (!q) return 'Vui lòng nhập chủ đề bình chọn';
    if (q.length > 200) return 'Chủ đề tối đa 200 ký tự';
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (clean.length < MIN_OPTIONS) return `Phải có ít nhất ${MIN_OPTIONS} phương án`;
    if (clean.some((o) => o.length > 100)) return 'Mỗi phương án tối đa 100 ký tự';
    const set = new Set(clean.map((s) => s.toLowerCase()));
    if (set.size !== clean.length) return 'Các phương án không được trùng nhau';
    if (expiryPreset === 'custom' && customExpiry) {
      const d = new Date(customExpiry);
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now())
        return 'Thời hạn không hợp lệ';
    }
    return null;
  };

  const handleSubmit = async () => {
    const errMsg = validate();
    if (errMsg) {
      setError(errMsg);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await chatServices.createPoll(conversationId, {
        question: question.trim(),
        options: options.map((o) => o.trim()).filter(Boolean),
        allowMultiple,
        allowAddOptions,
        hideResultsUntilVoted,
        hideVoters,
        expiresAt: computeExpiresAt(),
      });
      toast.success('Đã tạo bình chọn');
      onCreated?.();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Tạo bình chọn thất bại';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-xl shadow-2xl w-[480px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <h2 className="text-[15px] font-semibold text-gray-800">Tạo bình chọn</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {/* Question */}
          <label className="block text-[13px] font-medium text-gray-600 mb-2">
            Chủ đề bình chọn
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (error) setError('');
            }}
            placeholder="Đặt câu hỏi cho bình chọn"
            maxLength={200}
            className="w-full px-3 py-2.5 text-[14px] bg-gray-50 text-gray-800 placeholder:text-gray-400 border border-gray-200 rounded-lg outline-none focus:border-[#0068FF]/60 focus:bg-white transition-colors"
            autoFocus
          />
          <div className="text-right text-[11px] text-gray-400 mt-1">{question.length}/200</div>

          {/* Expiry */}
          <label className="block text-[13px] font-medium text-gray-600 mt-3 mb-2">
            Thời hạn
          </label>
          <select
            value={expiryPreset}
            onChange={(e) => setExpiryPreset(e.target.value as ExpiryPreset)}
            className="w-full px-3 py-2 text-[13px] bg-gray-50 text-gray-800 border border-gray-200 rounded-lg outline-none focus:border-[#0068FF]/60 cursor-pointer"
          >
            <option value="none">Không giới hạn</option>
            <option value="1h">1 giờ</option>
            <option value="24h">24 giờ</option>
            <option value="3d">3 ngày</option>
            <option value="custom">Tùy chỉnh…</option>
          </select>
          {expiryPreset === 'custom' && (
            <input
              type="datetime-local"
              value={customExpiry}
              onChange={(e) => setCustomExpiry(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              className="w-full mt-2 px-3 py-2 text-[13px] bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#0068FF]/60"
            />
          )}

          {/* Options */}
          <label className="block text-[13px] font-medium text-gray-600 mt-4 mb-2">
            Các lựa chọn ({options.length}/{MAX_OPTIONS})
          </label>
          <div className="flex flex-col gap-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  placeholder={`Phương án ${idx + 1}`}
                  maxLength={100}
                  className="flex-1 px-3 py-2 text-[13px] bg-gray-50 text-gray-800 placeholder:text-gray-400 border border-gray-200 rounded-lg outline-none focus:border-[#0068FF]/60 focus:bg-white transition-colors"
                />
                {options.length > MIN_OPTIONS && (
                  <button
                    onClick={() => removeOption(idx)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Xóa phương án"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < MAX_OPTIONS && (
            <button
              onClick={addOption}
              className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] text-[#0068FF] hover:bg-[#0068FF]/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm phương án
            </button>
          )}

          {/* Advanced */}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="mt-4 flex items-center gap-1 text-[13px] font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Thiết lập nâng cao
          </button>
          {showAdvanced && (
            <div className="mt-2 flex flex-col gap-2 pl-1">
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  className="w-4 h-4 accent-[#0068FF]"
                />
                Cho phép chọn nhiều phương án
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAddOptions}
                  onChange={(e) => setAllowAddOptions(e.target.checked)}
                  className="w-4 h-4 accent-[#0068FF]"
                />
                Cho phép thành viên thêm phương án
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideResultsUntilVoted}
                  onChange={(e) => setHideResultsUntilVoted(e.target.checked)}
                  className="w-4 h-4 accent-[#0068FF]"
                />
                Ẩn kết quả khi chưa bình chọn
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideVoters}
                  onChange={(e) => setHideVoters(e.target.checked)}
                  className="w-4 h-4 accent-[#0068FF]"
                />
                Ẩn danh sách người bình chọn
              </label>
            </div>
          )}

          {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !question.trim()}
            className="px-5 py-1.5 rounded-lg text-[13px] font-medium text-white bg-[#0068FF] hover:bg-[#0054CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Đang tạo...' : 'Tạo bình chọn'}
          </button>
        </div>
      </div>
    </>
  );
}
