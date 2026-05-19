import { useState, useCallback } from 'react';
import { X, Clock, ChevronDown } from 'lucide-react';
import { chatServices } from '@/services/chatServices';
import type { Reminder, RepeatType } from '@/types/reminder.type';

interface Props {
  conversationId: string;
  initialReminder?: Reminder; // if provided → edit mode
  onClose: () => void;
  onSaved: (reminder: Reminder) => void;
}

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none', label: 'Không lặp lại' },
  { value: 'daily', label: 'Hàng ngày' },
  { value: 'weekly', label: 'Hàng tuần' },
  { value: 'monthly', label: 'Hàng tháng' },
];

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60_000);
}

function tomorrowAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export default function CreateReminderModal({
  conversationId,
  initialReminder,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!initialReminder;

  const [content, setContent] = useState(initialReminder?.content ?? '');
  const [remindAt, setRemindAt] = useState<string>(
    initialReminder
      ? toLocalDatetimeString(new Date(initialReminder.remindAt))
      : toLocalDatetimeString(addMinutes(new Date(), 30))
  );
  const [repeat, setRepeat] = useState<RepeatType>(initialReminder?.repeat ?? 'none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const applyPreset = useCallback((preset: 'p15' | 'p30' | 'tomorrow9' | 'custom') => {
    const now = new Date();
    if (preset === 'p15') setRemindAt(toLocalDatetimeString(addMinutes(now, 15)));
    else if (preset === 'p30') setRemindAt(toLocalDatetimeString(addMinutes(now, 30)));
    else if (preset === 'tomorrow9') setRemindAt(toLocalDatetimeString(tomorrowAt9()));
    // 'custom' — just show the datetime input as-is
  }, []);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Vui lòng nhập nội dung nhắc hẹn');
      return;
    }
    if (!remindAt) {
      setError('Vui lòng chọn thời gian');
      return;
    }

    const remindAtISO = new Date(remindAt).toISOString();
    if (new Date(remindAtISO) <= new Date()) {
      setError('Thời gian nhắc hẹn phải ở tương lai');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let saved: Reminder;
      if (isEdit && initialReminder) {
        saved = await chatServices.updateReminder(initialReminder._id, {
          content: content.trim(),
          remindAt: remindAtISO,
          repeat,
        });
      } else {
        saved = await chatServices.createReminder(conversationId, {
          content: content.trim(),
          remindAt: remindAtISO,
          repeat,
        });
      }
      onSaved(saved);
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Determine active preset
  const nowStr = toLocalDatetimeString(new Date());
  const p15Str = toLocalDatetimeString(addMinutes(new Date(), 15));
  const p30Str = toLocalDatetimeString(addMinutes(new Date(), 30));
  const tom9Str = toLocalDatetimeString(tomorrowAt9());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white text-gray-800 rounded-xl w-[440px] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <h3 className="text-[15px] font-semibold text-gray-800">
              {isEdit ? 'Sửa nhắc hẹn' : 'Tạo nhắc hẹn'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Content */}
          <div>
            <label className="block text-[12px] text-gray-500 mb-1.5">Nhập nội dung</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung mới hoặc dán link"
              rows={3}
              className="w-full bg-gray-50 text-gray-800 text-[13px] rounded-lg px-3 py-2.5 border border-gray-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none placeholder:text-gray-400"
            />
          </div>

          {/* Time presets */}
          <div>
            <label className="block text-[12px] text-gray-500 mb-1.5">Chọn thời gian</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'p15', label: '15 phút nữa', value: p15Str },
                { id: 'p30', label: '30 phút nữa', value: p30Str },
                { id: 'tomorrow9', label: '9:00 ngày mai', value: tom9Str },
              ].map(({ id, label, value }) => (
                <button
                  key={id}
                  onClick={() => applyPreset(id as any)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                    remindAt === value
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => applyPreset('custom')}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                  ![p15Str, p30Str, tom9Str].includes(remindAt) && remindAt > nowStr
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                Khác
              </button>
            </div>
          </div>

          {/* Datetime picker */}
          <div>
            <label className="block text-[12px] text-gray-500 mb-1.5">Chọn ngày nhắc hẹn</label>
            <input
              type="datetime-local"
              value={remindAt}
              min={toLocalDatetimeString(addMinutes(new Date(), 1))}
              onChange={(e) => setRemindAt(e.target.value)}
              className="w-full bg-gray-50 text-gray-800 text-[13px] rounded-lg px-3 py-2.5 border border-gray-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
            />
          </div>

          {/* Repeat */}
          <div>
            <label className="block text-[12px] text-gray-500 mb-1.5">
              Chọn kiểu lặp lại (vd: Lặp lại hàng tuần)
            </label>
            <div className="relative">
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as RepeatType)}
                className="w-full appearance-none bg-gray-50 text-gray-800 text-[13px] rounded-lg px-3 py-2.5 border border-gray-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 pr-8"
              >
                {REPEAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-red-500 text-[12px]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo nhắc hẹn'}
          </button>
        </div>
      </div>
    </div>
  );
}
