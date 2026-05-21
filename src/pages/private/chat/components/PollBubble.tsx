import { useMemo, useState, useEffect } from 'react';
import { BarChart2, Plus, Lock, Trash2, X, Pencil, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import { chatServices } from '@/services/chatServices';
import { useAppSelector, useAppDispatch } from '@/hooks/useRedux';
import { socketPollUpdated } from '@/store/slices/chatSlice';
import type { Message } from '@/types/chat.type';
import type { PollView } from '@/types/poll.type';

interface Props {
  message: Message;
  conversationId: string;
  isMine: boolean;
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Đã hết hạn';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `Còn ${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Còn ${hours} giờ`;
  const days = Math.floor(hours / 24);
  return `Còn ${days} ngày`;
}

export default function PollBubble({ message, conversationId, isMine }: Props) {
  const currentUser = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const conv = useAppSelector((s) => s.chat.conversations.find((c) => c._id === conversationId));
  const memberProfiles = useAppSelector((s) => s.chat.groupMemberProfiles);

  const poll = message.metadata?.poll as PollView | undefined;
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [newOptionText, setNewOptionText] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState('');
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editOptionText, setEditOptionText] = useState('');
  const [voterPopupId, setVoterPopupId] = useState<string | null>(null);

  // When creator loads a poll with hideResultsUntilVoted from message history (canonical view),
  // the canonical view has canSeeResults=false. Re-fetch personalized view for creator.
  useEffect(() => {
    if (
      poll &&
      poll.hideResultsUntilVoted &&
      !poll.canSeeResults &&
      currentUser?.id === poll.createdBy
    ) {
      chatServices
        .getPoll(poll._id)
        .then((freshPoll) => {
          dispatch(
            socketPollUpdated({
              messageId: message._id,
              conversationId,
              poll: freshPoll,
            })
          );
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll?._id, poll?.canSeeResults]);

  // Derive: when user is the actor of a vote/add, prefer locally-computed myVotes
  // because backend broadcast uses '__broadcast__' and returns myVotes=[]
  const effectiveMyVotes = useMemo(() => {
    if (!poll) return [];
    if (pendingIds) return pendingIds;
    if (poll.myVotes && poll.myVotes.length > 0) return poll.myVotes;
    // Compute from voters list when not hidden
    if (!poll.hideVoters && currentUser?.id) {
      return poll.options.filter((o) => o.voters?.includes(currentUser.id)).map((o) => o._id);
    }
    return [];
  }, [poll, pendingIds, currentUser?.id]);

  if (!poll) {
    return (
      <div className="text-[12px] text-gray-400 italic px-3 py-2">Bình chọn không khả dụng</div>
    );
  }

  const isCreator = currentUser?.id === poll.createdBy;
  // Only the poll creator can close/delete the poll
  const canManage = isCreator;
  const isActive = !poll.isClosed && !poll.isExpired;
  const hasVoted = effectiveMyVotes.length > 0;
  const showResults = poll.canSeeResults || hasVoted || !isActive;

  const creatorParticipant = conv?.participants?.find((p) => p.userId === poll.createdBy);
  const creatorName =
    poll.createdBy === currentUser?.id ? 'Bạn' : (creatorParticipant?.nickname ?? 'Thành viên');

  const handleToggleVote = async (optionId: string) => {
    if (!isActive || busy) return;
    let nextIds: string[];
    if (poll.allowMultiple) {
      nextIds = effectiveMyVotes.includes(optionId)
        ? effectiveMyVotes.filter((id) => id !== optionId)
        : [...effectiveMyVotes, optionId];
    } else {
      nextIds = effectiveMyVotes.includes(optionId) ? [] : [optionId];
    }
    setPendingIds(nextIds);
    setBusy(true);
    try {
      await chatServices.votePoll(poll._id, nextIds);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Bình chọn thất bại';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
      setPendingIds(null);
    } finally {
      setBusy(false);
    }
  };

  const handleAddOption = async () => {
    const text = newOptionText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await chatServices.addPollOption(poll._id, text);
      setNewOptionText('');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Không thể thêm phương án';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (busy) return;
    if (!window.confirm('Kết thúc bình chọn này?')) return;
    setBusy(true);
    try {
      await chatServices.closePoll(poll._id);
      toast.success('Đã kết thúc bình chọn');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Không thể kết thúc';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    if (!window.confirm('Xóa bình chọn này? Hành động không thể hoàn tác.')) return;
    setBusy(true);
    try {
      await chatServices.deletePoll(poll._id);
      toast.success('Đã xóa bình chọn');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Không thể xóa';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleEditSave = async () => {
    const trimmed = editQuestion.trim();
    if (!trimmed || trimmed === poll.question || busy) return;
    setBusy(true);
    try {
      await chatServices.updatePoll(poll._id, trimmed);
      setEditing(false);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Không thể cập nhật';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateOption = async () => {
    if (!editingOptionId) return;
    const trimmed = editOptionText.trim();
    const original = poll.options.find((o) => o._id === editingOptionId)?.text ?? '';
    if (!trimmed || trimmed === original || busy) return;
    setBusy(true);
    try {
      await chatServices.updatePollOption(poll._id, editingOptionId, trimmed);
      setEditingOptionId(null);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Không thể sửa phương án';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOption = async (optionId: string) => {
    if (busy) return;
    if (!window.confirm('Xóa phương án này?')) return;
    setBusy(true);
    try {
      await chatServices.deletePollOption(poll._id, optionId);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Không thể xóa phương án';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setBusy(false);
    }
  };

  const resolveVoterProfile = (uid: string): { name: string; avatar?: string | null } => {
    if (uid === currentUser?.id) return { name: 'Bạn', avatar: currentUser.avatar };
    const profile = memberProfiles[uid];
    if (profile) return { name: profile.fullName, avatar: profile.avatar };
    return { name: 'Thành viên', avatar: null };
  };

  const totalVoters = poll.totalVoters || 0;
  const align = isMine ? 'items-end' : 'items-start';

  return (
    <div className={`flex flex-col ${align} w-full my-1`}>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm w-[360px] max-w-[88vw] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#0068FF]/5 to-transparent">
          <div className="w-7 h-7 rounded-full bg-[#0068FF]/10 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-[#0068FF]" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[11px] text-gray-500 font-medium">Bình chọn · {creatorName}</span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              {poll.allowMultiple ? 'Chọn nhiều' : 'Chọn một'}
              {poll.expiresAt && (
                <>
                  <span>·</span>
                  <span>{formatRemaining(poll.expiresAt)}</span>
                </>
              )}
              {poll.isClosed && (
                <>
                  <span>·</span>
                  <Lock className="w-3 h-3" />
                  <span>Đã kết thúc</span>
                </>
              )}
            </span>
          </div>
          {canManage && isActive && (
            <button
              onClick={() => {
                setEditQuestion(poll.question);
                setEditing(true);
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-[#0068FF] hover:bg-[#0068FF]/10 transition-colors shrink-0"
              title="Sửa câu hỏi"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Question */}
        <div className="px-4 pt-3 pb-2">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSave();
                  if (e.key === 'Escape') setEditing(false);
                }}
                maxLength={200}
                className="flex-1 px-2 py-1 text-[13px] font-semibold text-gray-800 bg-gray-50 border border-[#0068FF]/40 rounded-md outline-none focus:border-[#0068FF]"
              />
              <button
                onClick={handleEditSave}
                disabled={!editQuestion.trim() || editQuestion.trim() === poll.question || busy}
                className="w-6 h-6 rounded-full bg-[#0068FF] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#0058e0] transition-colors"
                title="Lưu"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors"
                title="Hủy"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <h3 className="text-[14px] font-semibold text-gray-800 break-words">{poll.question}</h3>
          )}
        </div>

        {/* Options */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          {poll.options.map((opt) => {
            const selected = effectiveMyVotes.includes(opt._id);
            const pct =
              showResults && totalVoters > 0 ? Math.round((opt.voteCount / totalVoters) * 100) : 0;
            const isEditingThis = editingOptionId === opt._id;
            const canDeleteThis =
              canManage && isActive && poll.options.length > 2 && opt.voteCount === 0;
            const voterList = showResults && !poll.hideVoters ? (opt.voters ?? []) : [];
            const isVotersOpen = voterPopupId === opt._id;
            return (
              <div key={opt._id} className="flex flex-col gap-0.5">
                <div
                  role="button"
                  tabIndex={isActive && !isEditingThis ? 0 : -1}
                  onClick={() => {
                    if (!isEditingThis) handleToggleVote(opt._id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isEditingThis) handleToggleVote(opt._id);
                  }}
                  className={`relative w-full rounded-lg border transition-all overflow-hidden ${
                    selected
                      ? 'border-[#0068FF] bg-[#0068FF]/5'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  } ${!isActive || isEditingThis ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {showResults && (
                    <div
                      className={`absolute inset-y-0 left-0 ${selected ? 'bg-[#0068FF]/10' : 'bg-gray-100'} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <div className="relative flex items-center gap-2 px-3 py-2">
                    <div
                      className={`shrink-0 w-4 h-4 ${poll.allowMultiple ? 'rounded' : 'rounded-full'} border-2 flex items-center justify-center transition-colors ${
                        selected ? 'border-[#0068FF] bg-[#0068FF]' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {selected && (
                        <div
                          className={`${poll.allowMultiple ? 'w-2 h-2 bg-white rounded-[1px]' : 'w-1.5 h-1.5 bg-white rounded-full'}`}
                        />
                      )}
                    </div>
                    {isEditingThis ? (
                      <div
                        className="flex-1 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={editOptionText}
                          onChange={(e) => setEditOptionText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateOption();
                            if (e.key === 'Escape') setEditingOptionId(null);
                          }}
                          maxLength={100}
                          className="flex-1 px-2 py-0.5 text-[13px] text-gray-800 bg-white border border-[#0068FF]/50 rounded outline-none focus:border-[#0068FF] min-w-0"
                        />
                        <button
                          onClick={handleUpdateOption}
                          disabled={
                            !editOptionText.trim() ||
                            editOptionText.trim() ===
                              (poll.options.find((o) => o._id === editingOptionId)?.text ?? '') ||
                            busy
                          }
                          className="w-5 h-5 rounded-full bg-[#0068FF] text-white flex items-center justify-center shrink-0 disabled:opacity-40"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingOptionId(null)}
                          className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 hover:bg-gray-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex-1 text-[13px] text-gray-800 break-words">
                        {opt.text}
                      </span>
                    )}
                    {showResults && !isEditingThis && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!poll.hideVoters && voterList.length > 0) {
                            setVoterPopupId((v) => (v === opt._id ? null : opt._id));
                          }
                        }}
                        className={`flex items-center gap-1.5 shrink-0 transition-opacity ${
                          !poll.hideVoters && voterList.length > 0
                            ? 'cursor-pointer hover:opacity-80'
                            : 'cursor-default'
                        }`}
                        title={
                          !poll.hideVoters && voterList.length > 0
                            ? 'Xem người đã bình chọn'
                            : undefined
                        }
                      >
                        {/* Overlapping avatar stack (max 3) */}
                        {!poll.hideVoters && voterList.length > 0 && (
                          <div
                            className="flex items-center"
                            style={{ marginRight: voterList.slice(0, 3).length * 2 }}
                          >
                            {voterList.slice(0, 3).map((uid, i) => {
                              const { name, avatar } = resolveVoterProfile(uid);
                              return (
                                <div
                                  key={uid}
                                  className="w-5 h-5 rounded-full border-2 border-white shrink-0 overflow-hidden"
                                  style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 3 - i }}
                                  title={name}
                                >
                                  {avatar ? (
                                    <img
                                      src={avatar}
                                      alt={name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-[#0068FF]/25 text-[#0068FF] flex items-center justify-center text-[7px] font-bold">
                                      {name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <span
                          className={`text-[12px] font-semibold ${opt.voteCount > 0 ? 'text-[#0068FF]' : 'text-gray-400'}`}
                        >
                          {opt.voteCount}
                        </span>
                      </button>
                    )}
                    {canManage && isActive && !isEditingThis && (
                      <div
                        className="flex items-center gap-0.5 shrink-0 ml-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingOptionId(opt._id);
                            setEditOptionText(opt.text);
                          }}
                          className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-[#0068FF] hover:bg-[#0068FF]/10 transition-colors"
                          title="Sửa phương án"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {canDeleteThis && (
                          <button
                            onClick={() => handleDeleteOption(opt._id)}
                            disabled={busy}
                            className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                            title="Xóa phương án"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {isVotersOpen && voterList.length > 0 && (
                  <div className="mx-1 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Đã bình chọn · {voterList.length}
                      </span>
                      <button
                        onClick={() => setVoterPopupId(null)}
                        className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="max-h-[160px] overflow-y-auto">
                      {voterList.map((uid) => {
                        const { name, avatar } = resolveVoterProfile(uid);
                        const isMe = uid === currentUser?.id;
                        return (
                          <div
                            key={uid}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors"
                          >
                            <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden border border-gray-100">
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-[#0068FF]/15 text-[#0068FF] flex items-center justify-center text-[10px] font-bold">
                                  {name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="text-[13px] text-gray-800 font-medium flex-1 truncate">
                              {name}
                            </span>
                            {isMe && (
                              <span className="text-[10px] text-[#0068FF] bg-[#0068FF]/10 rounded-full px-1.5 py-0.5 shrink-0">
                                Bạn
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add option */}
        {poll.allowAddOptions && isActive && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <input
              type="text"
              value={newOptionText}
              onChange={(e) => setNewOptionText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
              placeholder="Thêm phương án..."
              maxLength={100}
              className="flex-1 px-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#0068FF]/60"
            />
            <button
              onClick={handleAddOption}
              disabled={!newOptionText.trim() || busy}
              className="w-7 h-7 rounded-full bg-[#0068FF]/10 text-[#0068FF] flex items-center justify-center hover:bg-[#0068FF]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Thêm phương án"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-500">{totalVoters} người đã bình chọn</span>
          {canManage && isActive && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleClose}
                disabled={busy}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 hover:bg-white rounded-md transition-colors disabled:opacity-50"
                title="Kết thúc bình chọn"
              >
                <X className="w-3 h-3" />
                Kết thúc
              </button>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                title="Xóa bình chọn"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
          {canManage && !isActive && (
            <button
              onClick={handleDelete}
              disabled={busy}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Xóa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
