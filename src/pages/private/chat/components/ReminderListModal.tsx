import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Clock, Pencil, Trash2, CheckCircle2, Circle, RotateCcw } from 'lucide-react';
import { chatServices } from '@/services/chatServices';
import type { Reminder, RepeatType } from '@/types/reminder.type';
import CreateReminderModal from './CreateReminderModal';

interface Props {
  conversationId: string;
  currentUserId: string;
  onClose: () => void;
}

const REPEAT_LABEL: Record<RepeatType, string> = {
  none: '',
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
};

function formatRemindAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hôm nay lúc ${timeStr}`;
  if (isTomorrow) return `Ngày mai lúc ${timeStr}`;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReminderListModal({ conversationId, currentUserId, onClose }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Reminder | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatServices.getReminders(conversationId);
      setReminders(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Sync when the other user updates or deletes a reminder (socket → CustomEvent)
  useEffect(() => {
    const onUpdated = (e: Event) => {
      const reminder: Reminder = (e as CustomEvent).detail?.reminder;
      if (!reminder) return;
      setReminders((prev) => {
        const idx = prev.findIndex((r) => r._id === reminder._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = reminder;
          return next.sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
        }
        // New reminder added by other means — only add if it belongs to this conversation
        if (reminder.conversationId === conversationId) {
          return [...prev, reminder].sort(
            (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()
          );
        }
        return prev;
      });
    };
    const onDeleted = (e: Event) => {
      const { reminderId } = (e as CustomEvent).detail ?? {};
      if (reminderId) setReminders((prev) => prev.filter((r) => r._id !== reminderId));
    };
    window.addEventListener('reminder:updated', onUpdated);
    window.addEventListener('reminder:deleted', onDeleted);
    return () => {
      window.removeEventListener('reminder:updated', onUpdated);
      window.removeEventListener('reminder:deleted', onDeleted);
    };
  }, [conversationId]);

  const handleSaved = useCallback((reminder: Reminder) => {
    setReminders((prev) => {
      const idx = prev.findIndex((r) => r._id === reminder._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = reminder;
        return next.sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
      }
      return [...prev, reminder].sort(
        (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()
      );
    });
    window.dispatchEvent(new CustomEvent('reminder:updated', { detail: { reminder } }));
    setShowCreate(false);
    setEditTarget(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await chatServices.deleteReminder(id);
      setReminders((prev) => prev.filter((r) => r._id !== id));
      window.dispatchEvent(new CustomEvent('reminder:deleted', { detail: { reminderId: id } }));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleComplete = useCallback(async (reminder: Reminder) => {
    if (reminder.isCompleted) return;
    setCompletingId(reminder._id);
    try {
      const updated = await chatServices.completeReminder(reminder._id);
      setReminders((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    } catch {
      // silent
    } finally {
      setCompletingId(null);
    }
  }, []);

  // Split into pending vs completed
  const pending = reminders.filter((r) => !r.isCompleted);
  const completed = reminders.filter((r) => r.isCompleted);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white text-gray-800 rounded-xl w-[480px] max-h-[80vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <h3 className="text-[15px] font-semibold text-gray-800">Danh sách nhắc hẹn</h3>
              {pending.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[11px] rounded-full font-medium">
                  {pending.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-medium rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm
              </button>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reminders.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-gray-400">
                <Clock className="w-12 h-12 opacity-20" />
                <p className="text-[13px]">Chưa có nhắc hẹn nào</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="text-blue-500 text-[12px] hover:underline"
                >
                  Tạo nhắc hẹn đầu tiên
                </button>
              </div>
            ) : (
              <>
                {/* Pending */}
                {pending.map((r) => (
                  <ReminderItem
                    key={r._id}
                    reminder={r}
                    currentUserId={currentUserId}
                    isDeleting={deletingId === r._id}
                    isCompleting={completingId === r._id}
                    onEdit={() => setEditTarget(r)}
                    onDelete={() => handleDelete(r._id)}
                    onComplete={() => handleComplete(r)}
                  />
                ))}

                {/* Completed section */}
                {completed.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] text-gray-400 px-2 pb-1 uppercase tracking-wide">
                      Đã hoàn thành ({completed.length})
                    </p>
                    {completed.map((r) => (
                      <ReminderItem
                        key={r._id}
                        reminder={r}
                        currentUserId={currentUserId}
                        isDeleting={deletingId === r._id}
                        isCompleting={false}
                        onEdit={() => setEditTarget(r)}
                        onDelete={() => handleDelete(r._id)}
                        onComplete={() => {}}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {showCreate && (
        <CreateReminderModal
          conversationId={conversationId}
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
        />
      )}
      {editTarget && (
        <CreateReminderModal
          conversationId={conversationId}
          initialReminder={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

// ── ReminderItem ─────────────────────────────────────────────────────────────

interface ItemProps {
  reminder: Reminder;
  currentUserId: string;
  isDeleting: boolean;
  isCompleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
}

function ReminderItem({
  reminder,
  currentUserId,
  isDeleting,
  isCompleting,
  onEdit,
  onDelete,
  onComplete,
}: ItemProps) {
  const isOwner = reminder.createdBy === currentUserId;
  const isPast = !reminder.isCompleted && new Date(reminder.remindAt) < new Date();

  return (
    <div
      className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-colors group ${
        reminder.isCompleted ? 'opacity-50' : isPast ? 'bg-red-50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Complete toggle */}
      <button
        onClick={onComplete}
        disabled={reminder.isCompleted || isCompleting}
        className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-green-500 disabled:cursor-default transition-colors"
        title={reminder.isCompleted ? 'Đã xong' : 'Đánh dấu hoàn thành'}
      >
        {isCompleting ? (
          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        ) : reminder.isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <Circle className="w-4 h-4" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[13px] leading-snug break-all ${
            reminder.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'
          }`}
        >
          {reminder.content}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className={`text-[11px] ${isPast && !reminder.isCompleted ? 'text-red-500' : 'text-gray-400'}`}
          >
            {formatRemindAt(reminder.remindAt)}
          </span>
          {reminder.repeat !== 'none' && (
            <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
              <RotateCcw className="w-2.5 h-2.5" />
              {REPEAT_LABEL[reminder.repeat]}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isOwner && !reminder.isCompleted && (
          <button
            onClick={onEdit}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Sửa"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {isOwner && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Xóa"
          >
            {isDeleting ? (
              <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
