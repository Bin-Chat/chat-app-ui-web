import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pin, PinOff, Pencil, Trash2, StickyNote } from 'lucide-react';
import { chatServices } from '@/services/chatServices';
import type { Note } from '@/types/note.type';
import CreateNoteModal from './CreateNoteModal';

interface Props {
  conversationId: string;
  currentUserId: string;
  isAdmin?: boolean;
  onClose: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hôm nay, ${timeStr}`;
  return `${d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}, ${timeStr}`;
}

function sortNotes(list: Note[]): Note[] {
  return [...list].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export default function NoteListModal({ conversationId, currentUserId, isAdmin, onClose }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Note | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatServices.getNotes(conversationId);
      setNotes(sortNotes(data));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime sync via custom events from socket
  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      if (detail.conversationId && detail.conversationId !== conversationId) return;
      const note: Note | undefined = detail.note;
      if (note) {
        setNotes((prev) => {
          const idx = prev.findIndex((n) => n._id === note._id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = note;
            return sortNotes(next);
          }
          return sortNotes([note, ...prev]);
        });
      }
    };
    const onDeleted = (e: Event) => {
      const { noteId } = (e as CustomEvent).detail ?? {};
      if (noteId) setNotes((prev) => prev.filter((n) => n._id !== noteId));
    };
    window.addEventListener('note:created', onSync);
    window.addEventListener('note:updated', onSync);
    window.addEventListener('note:deleted', onDeleted);
    return () => {
      window.removeEventListener('note:created', onSync);
      window.removeEventListener('note:updated', onSync);
      window.removeEventListener('note:deleted', onDeleted);
    };
  }, [conversationId]);

  const handleSaved = useCallback((note: Note) => {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n._id === note._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = note;
        return sortNotes(next);
      }
      return sortNotes([note, ...prev]);
    });
  }, []);

  const handleTogglePin = async (note: Note) => {
    try {
      const updated = await chatServices.updateNote(note._id, { isPinned: !note.isPinned });
      handleSaved(updated);
    } catch {
      // silent
    }
  };

  const handleDelete = async (note: Note) => {
    setDeletingId(note._id);
    try {
      await chatServices.deleteNote(note._id);
      setNotes((prev) => prev.filter((n) => n._id !== note._id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const canModify = (note: Note) => note.createdBy === currentUserId || !!isAdmin;
  const pinnedCount = notes.filter((n) => n.isPinned).length;
  const MAX_PINNED = 3;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl w-[480px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[16px] font-bold text-gray-800 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" />
            Ghi chú ({notes.length})
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Create button */}
        <div className="px-5 pt-3 pb-2">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#EBF3FF] text-[#0068FF] text-[13px] font-medium hover:bg-[#D6E7FF] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tạo ghi chú mới
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {loading ? (
            <p className="text-center text-[13px] text-gray-400 mt-6">Đang tải...</p>
          ) : notes.length === 0 ? (
            <div className="text-center mt-10 px-6">
              <StickyNote className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-[13px] text-gray-500">Chưa có ghi chú nào</p>
              <p className="text-[12px] text-gray-400 mt-1">
                Tạo ghi chú để lưu thông tin quan trọng của cuộc trò chuyện
              </p>
            </div>
          ) : (
            <ul className="space-y-2 pt-1">
              {notes.map((note) => (
                <li
                  key={note._id}
                  className={`group relative rounded-xl border p-3 transition-colors ${
                    note.isPinned
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {note.isPinned && (
                    <span className="absolute -top-1.5 -left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-medium rounded-full shadow">
                      <Pin className="w-2.5 h-2.5" /> Đã ghim
                    </span>
                  )}

                  <p className="text-[13px] text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                    {note.content}
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      Cập nhật {formatTime(note.updatedAt)}
                    </span>
                    {canModify(note) && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            !note.isPinned && pinnedCount >= MAX_PINNED
                              ? undefined
                              : handleTogglePin(note)
                          }
                          title={
                            !note.isPinned && pinnedCount >= MAX_PINNED
                              ? 'Đã ghim tối đa 3 ghi chú'
                              : note.isPinned
                                ? 'Bỏ ghim'
                                : 'Ghim'
                          }
                          disabled={!note.isPinned && pinnedCount >= MAX_PINNED}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            !note.isPinned && pinnedCount >= MAX_PINNED
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'hover:bg-white text-gray-500 hover:text-amber-500'
                          }`}
                        >
                          {note.isPinned ? (
                            <PinOff className="w-3.5 h-3.5" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {note.createdBy === currentUserId && (
                          <button
                            onClick={() => setEditTarget(note)}
                            title="Sửa"
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white text-gray-500 hover:text-blue-500 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(note)}
                          disabled={deletingId === note._id}
                          title="Xóa"
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white text-gray-500 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateNoteModal
          conversationId={conversationId}
          pinnedCount={pinnedCount}
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
        />
      )}

      {editTarget && (
        <CreateNoteModal
          conversationId={conversationId}
          initialNote={editTarget}
          pinnedCount={pinnedCount}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[70]"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] bg-white rounded-2xl p-5 w-[320px] shadow-xl">
            <h3 className="text-[15px] font-semibold text-gray-800 mb-1.5">Xóa ghi chú?</h3>
            <p className="text-[13px] text-gray-500 mb-5 leading-relaxed">
              Ghi chú này sẽ bị xóa vĩnh viễn và không thể khôi phục.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deletingId === confirmDelete._id}
                className="px-4 py-1.5 rounded-lg text-[13px] text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletingId === confirmDelete._id ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
