import { useState } from 'react';
import { X, Pin } from 'lucide-react';
import { chatServices } from '@/services/chatServices';
import type { Note } from '@/types/note.type';

interface Props {
  conversationId: string;
  initialNote?: Note; // edit mode if provided
  pinnedCount?: number; // current # of pinned notes in conversation
  onClose: () => void;
  onSaved: (note: Note) => void;
}

export default function CreateNoteModal({
  conversationId,
  initialNote,
  pinnedCount = 0,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!initialNote;
  const [content, setContent] = useState(initialNote?.content ?? '');
  const [isPinned, setIsPinned] = useState(initialNote?.isPinned ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Disable pin if already at limit — unless this note is already pinned
  const MAX_PINNED = 3;
  const pinLimitReached = pinnedCount >= MAX_PINNED && !initialNote?.isPinned;

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError('Vui lòng nhập nội dung ghi chú');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const saved =
        isEdit && initialNote
          ? await chatServices.updateNote(initialNote._id, { content: trimmed, isPinned })
          : await chatServices.createNote(conversationId, { content: trimmed, isPinned });
      onSaved(saved);
      onClose();
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-xl shadow-2xl w-[440px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold text-gray-800">
            {isEdit ? 'Sửa ghi chú' : 'Tạo ghi chú'}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          <label className="block text-[13px] font-medium text-gray-600 mb-2">Nội dung</label>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError('');
            }}
            placeholder="Nhập nội dung mới hoặc dán link"
            maxLength={2000}
            rows={6}
            className="w-full px-3 py-2.5 text-[14px] bg-gray-50 text-gray-800 placeholder:text-gray-400 border border-gray-200 rounded-lg outline-none focus:border-[#0068FF]/60 focus:bg-white transition-colors resize-none"
            autoFocus
          />
          <div className="text-right text-[11px] text-gray-400 mt-1">{content.length}/2000</div>

          <label
            className={`mt-3 flex items-center gap-2 select-none ${pinLimitReached ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => !pinLimitReached && setIsPinned(e.target.checked)}
              disabled={pinLimitReached}
              className="w-4 h-4 accent-[#0068FF] disabled:cursor-not-allowed"
            />
            <Pin className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[13px] text-gray-600">Ghim lên đầu trò chuyện</span>
            {pinLimitReached && (
              <span className="ml-1 text-[11px] text-amber-600 font-medium">
                Đã ghim tối đa 3 ghi chú
              </span>
            )}
          </label>

          {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className="px-5 py-1.5 rounded-lg text-[13px] font-medium text-white bg-[#0068FF] hover:bg-[#0054CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Đang lưu...' : isEdit ? 'Lưu' : 'Tạo ghi chú'}
          </button>
        </div>
      </div>
    </>
  );
}
