import { useState, useRef, useEffect } from 'react';
import { Clock, MoreHorizontal, Check, ChevronRight, X } from 'lucide-react';
import { chatServices } from '@/services/chatServices';
import CreateReminderModal from './CreateReminderModal';
import type { Reminder } from '@/types/reminder.type';

interface ReminderMeta {
  type: 'reminder_created';
  reminderId: string;
  content: string;
  remindAt: string;
  repeat: string;
  createdBy: string;
}

interface Props {
  metadata: ReminderMeta;
  currentUserId: string;
  currentUserName: string;
  conversationId: string;
  messageId: string;
  conversationType?: 'direct' | 'group' | string;
}

const WEEK_DAYS_FULL = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEK_DAYS_CAL = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatBannerDate(d: Date): string {
  return `${WEEK_DAYS_FULL[d.getDay()]}, ${d.getDate()} Tháng ${pad2(d.getMonth() + 1)} lúc ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatTimeCard(d: Date): string {
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const h = pad2(d.getHours());
  const m = pad2(d.getMinutes());
  if (isToday) return `Hôm nay lúc ${h}:${m}`;
  if (isTomorrow) return `Ngày mai lúc ${h}:${m}`;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} lúc ${h}:${m}`;
}

export default function ReminderMessageCard({
  metadata,
  currentUserId,
  currentUserName,
  conversationId,
  conversationType,
}: Props) {
  const [reminder, setReminder] = useState<Reminder | null | undefined>(undefined);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRsvp, setShowRsvp] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatServices
      .getReminders(conversationId)
      .then((list: Reminder[]) => {
        const found = list.find((r) => r._id === metadata.reminderId);
        setReminder(found ?? null);
      })
      .catch(() => setReminder(null));
  }, [metadata.reminderId, conversationId]);

  // Sync with ReminderListModal actions (same browser tab)
  useEffect(() => {
    const onDeleted = (e: Event) => {
      if ((e as CustomEvent).detail?.reminderId === metadata.reminderId) setReminder(null);
    };
    const onUpdated = (e: Event) => {
      const updated: Reminder = (e as CustomEvent).detail?.reminder;
      if (updated?._id === metadata.reminderId) setReminder(updated);
    };
    window.addEventListener('reminder:deleted', onDeleted);
    window.addEventListener('reminder:updated', onUpdated);
    return () => {
      window.removeEventListener('reminder:deleted', onDeleted);
      window.removeEventListener('reminder:updated', onUpdated);
    };
  }, [metadata.reminderId]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const remindAt = new Date(metadata.remindAt);
  const bannerDate = formatBannerDate(remindAt);
  const calDayNum = remindAt.getDate();
  const calDayName = WEEK_DAYS_CAL[remindAt.getDay()];
  const calMonth = `THÁNG ${pad2(remindAt.getMonth() + 1)}`;
  const timeStr = formatTimeCard(remindAt);

  const rsvps = reminder?.rsvps ?? [];
  const myRsvp = rsvps.find((r) => r.userId === currentUserId);
  const yesCount = rsvps.filter((r) => r.status === 'yes').length;

  const handleRsvp = async (status: 'yes' | 'no') => {
    if (rsvpLoading) return;
    setRsvpLoading(true);
    try {
      const updated = await chatServices.rsvpReminder(metadata.reminderId, status, currentUserName);
      setReminder(updated);
    } catch {
      /* ignore */
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    try {
      await chatServices.deleteReminder(metadata.reminderId);
      setReminder(null);
      window.dispatchEvent(new CustomEvent('reminder:deleted', { detail: { reminderId: metadata.reminderId } }));
    } catch {
      /* ignore */
    }
  };

  // Loading
  if (reminder === undefined) {
    return (
      <div className="flex justify-center my-3">
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Deleted / not found
  if (reminder === null) {
    return (
      <div className="flex justify-center my-1.5">
        <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full select-none italic">
          Nhắc hẹn đã bị hủy
        </span>
      </div>
    );
  }

  // Only the creator can edit/delete
  const isOwner = metadata.createdBy === currentUserId;

  // Use live reminder data so card reflects edits immediately
  const cardDate = new Date(reminder.remindAt);
  const cardCalDayNum = cardDate.getDate();
  const cardCalDayName = WEEK_DAYS_CAL[cardDate.getDay()];
  const cardCalMonth = `THÁNG ${pad2(cardDate.getMonth() + 1)}`;
  const cardTimeStr = formatTimeCard(cardDate);

  return (
    <div className="flex flex-col items-center gap-2 my-2 w-full">
      {/* ── Banner notification ── */}
      <div className="flex items-start gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700/60 rounded-2xl max-w-[380px]">
        <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-[1px]" />
        <p className="text-[11px] text-gray-500 dark:text-gray-300 leading-snug break-words">
          Bạn tạo nhắc hẹn mới{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-100">{metadata.content}</span>
          {' - '}
          {bannerDate}
          {' . '}
          <button className="text-blue-400 hover:underline font-medium">Xem</button>
        </p>
      </div>

      {/* ── Reminder card ── */}
      <div className="w-[310px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600/60 rounded-2xl overflow-visible shadow-sm">
        {/* Top: calendar + info + menu */}
        <div className="flex items-start gap-3 p-3">
          {/* Calendar block */}
          <div className="flex flex-col items-center w-[60px] rounded-xl border border-gray-200 dark:border-gray-600/50 overflow-hidden flex-shrink-0 shadow-sm">
            <div className="w-full bg-blue-600 text-center py-1">
              <span className="text-[8px] font-bold text-white tracking-wider">{cardCalDayName}</span>
            </div>
            <div className="flex flex-col items-center justify-center py-2 w-full bg-white dark:bg-gray-700/40">
              <span className="text-[26px] font-bold text-gray-900 dark:text-white leading-none">
                {cardCalDayNum}
              </span>
              <span className="text-[8px] text-gray-400 dark:text-gray-500 tracking-wider mt-1">
                {cardCalMonth}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col gap-1 pt-0.5">
            <p className="text-[14px] font-semibold text-gray-900 dark:text-white leading-tight break-words">
              {reminder.content}
            </p>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="text-[12px] text-gray-500 dark:text-gray-400">{cardTimeStr}</span>
            </div>
            {yesCount > 0 && (
              <button
                onClick={() => setShowRsvp(true)}
                className="flex items-center gap-0.5 text-[12px] text-blue-500 font-medium w-fit hover:underline"
              >
                <span>{yesCount} người tham gia</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* "..." menu — owner only */}
          {isOwner && (
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowEdit(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Sửa nhắc hẹn
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Hủy nhắc hẹn
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RSVP section */}
        <div className="border-t border-gray-100 dark:border-gray-700/70 px-4 py-2.5">
          {myRsvp ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span className="text-[12px] text-gray-600 dark:text-gray-300 truncate">
                  Bạn xác nhận:{' '}
                  <span className="font-medium">
                    {myRsvp.status === 'yes' ? 'Tham gia' : 'Không tham gia'}
                  </span>
                  .
                </span>
              </div>
              <button
                onClick={() => handleRsvp(myRsvp.status === 'yes' ? 'no' : 'yes')}
                disabled={rsvpLoading}
                className="text-[12px] text-blue-500 hover:underline disabled:opacity-50 flex-shrink-0 font-medium"
              >
                Thay đổi
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
                Bạn có tham gia không?
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleRsvp('yes')}
                  disabled={rsvpLoading}
                  className="text-[12px] text-blue-500 font-semibold hover:underline disabled:opacity-50"
                >
                  Tham gia
                </button>
                <span className="text-gray-300 dark:text-gray-600 text-[10px]">|</span>
                <button
                  onClick={() => handleRsvp('no')}
                  disabled={rsvpLoading}
                  className="text-[12px] text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-50"
                >
                  Từ chối
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RSVP list modal */}
      {showRsvp && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
          onClick={() => setShowRsvp(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl w-[300px] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h4 className="text-[14px] font-semibold text-gray-800 dark:text-white">Phản hồi nhắc hẹn</h4>
              <button
                onClick={() => setShowRsvp(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-3 py-2 max-h-[320px] overflow-y-auto">
              {rsvps.length === 0 ? (
                <p className="text-center text-[12px] text-gray-400 py-6">Chưa có ai phản hồi</p>
              ) : (
                <>
                  {rsvps.filter((r) => r.status === 'yes').length > 0 && (
                    <>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide px-2 pt-2 pb-1">Tham gia ({rsvps.filter((r) => r.status === 'yes').length})</p>
                      {rsvps.filter((r) => r.status === 'yes').map((r) => (
                        <div key={r.userId} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          </div>
                          <span className="text-[13px] text-gray-700 dark:text-gray-200 flex-1 truncate">{r.name}</span>
                          <span className="text-[11px] text-green-500 font-medium">Tham gia</span>
                        </div>
                      ))}
                    </>
                  )}
                  {rsvps.filter((r) => r.status === 'no').length > 0 && (
                    <>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide px-2 pt-3 pb-1">Từ chối ({rsvps.filter((r) => r.status === 'no').length})</p>
                      {rsvps.filter((r) => r.status === 'no').map((r) => (
                        <div key={r.userId} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                            <X className="w-3.5 h-3.5 text-red-500" />
                          </div>
                          <span className="text-[13px] text-gray-700 dark:text-gray-200 flex-1 truncate">{r.name}</span>
                          <span className="text-[11px] text-red-400 font-medium">Từ chối</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <CreateReminderModal
          conversationId={conversationId}
          initialReminder={reminder}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setReminder(updated);
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}
