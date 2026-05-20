import { useState, useEffect } from 'react';
import { StickyNote, Pencil, Pin, PinOff } from 'lucide-react';
import { chatServices } from '@/services/chatServices';
import type { Note } from '@/types/note.type';
import CreateNoteModal from './CreateNoteModal';

export interface NoteMeta {
  type: 'note_action';
  action: 'create' | 'create_pin' | 'pin' | 'unpin' | 'edit' | 'delete';
  noteId: string;
  content?: string;
  actorName: string;
  isPinned?: boolean;
}

const ACTION_LABELS: Record<NoteMeta['action'], string> = {
  create: 'đã tạo ghi chú',
  create_pin: 'đã tạo và ghim ghi chú',
  pin: 'đã ghim ghi chú',
  unpin: 'đã bỏ ghim ghi chú',
  edit: 'đã chỉnh sửa ghi chú',
  delete: 'đã xóa ghi chú',
};

interface Props {
  metadata: NoteMeta;
  currentUserId: string;
  conversationId: string;
}

export default function NoteMessageCard({ metadata, currentUserId, conversationId }: Props) {
  const [note, setNote] = useState<Note | null | undefined>(undefined); // undefined = loading
  const [showEdit, setShowEdit] = useState(false);
  const [allNotes, setAllNotes] = useState<Note[]>([]);

  useEffect(() => {
    chatServices
      .getNotes(conversationId)
      .then((list: Note[]) => {
        setAllNotes(list);
        const found = list.find((n) => n._id === metadata.noteId);
        setNote(found ?? null);
      })
      .catch(() => setNote(null));
  }, [metadata.noteId, conversationId]);

  // Sync with note events (same-tab)
  useEffect(() => {
    const onUpdated = (e: Event) => {
      const updated: Note = (e as CustomEvent).detail?.note;
      if (updated?._id === metadata.noteId) {
        setNote(updated);
        setAllNotes((prev) => prev.map((n) => (n._id === updated._id ? updated : n)));
      }
    };
    const onDeleted = (e: Event) => {
      const { noteId } = (e as CustomEvent).detail ?? {};
      if (noteId === metadata.noteId) setNote(null);
    };
    window.addEventListener('note:updated', onUpdated);
    window.addEventListener('note:deleted', onDeleted);
    return () => {
      window.removeEventListener('note:updated', onUpdated);
      window.removeEventListener('note:deleted', onDeleted);
    };
  }, [metadata.noteId]);

  const pinnedCount = allNotes.filter((n) => n.isPinned).length;
  const label = ACTION_LABELS[metadata.action] ?? 'đã cập nhật ghi chú';
  const isCreator = note?.createdBy === currentUserId;

  // Delete / unpin — simple amber pill with icon
  if (metadata.action === 'delete' || metadata.action === 'unpin') {
    return (
      <div className="flex justify-center my-2 px-4">
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
          {metadata.action === 'unpin' ? (
            <PinOff className="w-3 h-3 text-gray-400" />
          ) : (
            <StickyNote className="w-3 h-3 text-gray-400" />
          )}
          <span className="text-[11px] text-gray-500 select-none">
            <span className="font-medium text-gray-700">{metadata.actorName}</span> {label}
          </span>
        </div>
      </div>
    );
  }

  // If note was deleted after this card was created
  if (note === null) {
    return (
      <div className="flex justify-center my-2 px-4">
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
          <StickyNote className="w-3 h-3 text-gray-400" />
          <span className="text-[11px] text-gray-400 italic select-none">
            {metadata.actorName} {label} · Ghi chú đã bị xóa
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center my-3 px-4">
        <div className="w-full max-w-[310px]">
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.09)]">
            {/* Top accent stripe */}
            <div className="h-[3px] bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

            {/* Header row */}
            <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
              {/* Icon */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-50 flex items-center justify-center border border-amber-100 flex-shrink-0">
                <StickyNote className="w-4 h-4 text-amber-500" />
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider leading-none mb-1">
                  Ghi chú
                </p>
                <p className="text-[12px] text-gray-500 leading-tight truncate">
                  <span className="text-gray-900 font-semibold">{metadata.actorName}</span> {label}
                </p>
              </div>
              {/* Pin badge */}
              {note?.isPinned && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-full border border-amber-100 flex-shrink-0">
                  <Pin className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">
                    Đã ghim
                  </span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px mx-4 bg-amber-100" />

            {/* Content */}
            <div className="px-4 py-3 bg-[#FFFDF5]">
              {note === undefined ? (
                <div className="space-y-2">
                  <div className="h-3 bg-amber-100/70 rounded-full animate-pulse" />
                  <div className="h-3 bg-amber-100/70 rounded-full animate-pulse w-4/5" />
                  <div className="h-3 bg-amber-100/70 rounded-full animate-pulse w-2/3" />
                </div>
              ) : (
                <p className="text-[13px] text-gray-800 leading-relaxed line-clamp-5 whitespace-pre-wrap break-words">
                  {note.content}
                </p>
              )}
            </div>

            {/* Footer — edit button */}
            {note !== undefined && isCreator && (
              <>
                <div className="h-px mx-4 bg-gray-100" />
                <div className="px-4 py-2.5">
                  <button
                    onClick={() => setShowEdit(true)}
                    className="flex items-center gap-1.5 text-[12px] text-[#0068FF] hover:text-[#0054CC] font-medium transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Chỉnh sửa ghi chú
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showEdit && note && (
        <CreateNoteModal
          conversationId={conversationId}
          initialNote={note}
          pinnedCount={pinnedCount}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setNote(updated);
            setAllNotes((prev) => prev.map((n) => (n._id === updated._id ? updated : n)));
            setShowEdit(false);
          }}
        />
      )}
    </>
  );
}
