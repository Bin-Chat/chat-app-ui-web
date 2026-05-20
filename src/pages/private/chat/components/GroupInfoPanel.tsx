import { useState, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  Check,
  Crown,
  Shield,
  UserPlus,
  UserMinus,
  LogOut,
  Trash2,
  Edit3,
  Camera,
  Settings,
  Ban,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import MediaInfoPanel from './MediaInfoPanel';
import ReminderListModal from './ReminderListModal';
import NoteListModal from './NoteListModal';
import {
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  updateGroup,
  changeGroupRole,
  transferGroupOwnership,
  dissolveGroup,
  updateGroupSettings,
  banGroupMember,
  unbanGroupMember,
} from '@/store/slices';
import UserAvatar from '@/components/UserAvatar';
import type { Conversation } from '@/types/chat.type';

interface GroupInfoPanelProps {
  conversation: Conversation;
  onClose: () => void;
}

type ConfirmAction =
  | { type: 'remove'; memberId: string; memberName: string }
  | { type: 'leave' }
  | { type: 'dissolve' }
  | { type: 'transfer'; memberId: string; memberName: string }
  | { type: 'transfer-and-leave'; memberId: string; memberName: string };

export default function GroupInfoPanel({ conversation, onClose }: GroupInfoPanelProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentUser = useAppSelector((s) => s.auth.user);
  const friends = useAppSelector((s) => s.friend.friends);
  const groupMemberProfiles = useAppSelector((s) => s.chat.groupMemberProfiles);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [showTransferForLeave, setShowTransferForLeave] = useState(false);
  const [showReminderList, setShowReminderList] = useState(false);
  const [showNoteList, setShowNoteList] = useState(false);

  const myParticipant = conversation.participants.find((p) => p.userId === currentUser?.id);
  const myRole = myParticipant?.role ?? 'member';
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const canManage = isOwner || isAdmin;

  const getMemberInfo = useCallback(
    (userId: string) => {
      if (userId === currentUser?.id) {
        return { name: 'Bạn', avatar: currentUser?.avatar };
      }
      const friend = friends.find((f) => f.user.id === userId);
      if (friend) {
        return { name: friend.user.fullName || 'Người dùng', avatar: friend.user.avatar };
      }
      const cached = groupMemberProfiles[userId];
      if (cached) {
        return { name: cached.fullName || 'Người dùng', avatar: cached.avatar };
      }
      return { name: 'Người dùng', avatar: undefined };
    },
    [currentUser, friends, groupMemberProfiles]
  );

  const sortedParticipants = useMemo(() => {
    return [...conversation.participants].sort((a, b) => {
      const order = { owner: 0, admin: 1, member: 2 };
      return (order[a.role] ?? 2) - (order[b.role] ?? 2);
    });
  }, [conversation.participants]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
            <Crown className="w-3 h-3" /> Chủ nhóm
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
            <Shield className="w-3 h-3" /> Phó nhóm
          </span>
        );
      default:
        return null;
    }
  };

  const handleConfirmExecute = async () => {
    if (!confirmAction) return;
    try {
      switch (confirmAction.type) {
        case 'remove':
          await dispatch(
            removeGroupMember({
              conversationId: conversation._id,
              memberId: confirmAction.memberId,
            })
          ).unwrap();
          toast.success(`Đã xóa ${confirmAction.memberName}`);
          break;
        case 'leave':
          await dispatch(leaveGroup(conversation._id)).unwrap();
          toast.success('Đã rời nhóm');
          navigate('/');
          onClose();
          break;
        case 'dissolve':
          await dispatch(dissolveGroup(conversation._id)).unwrap();
          toast.success('Đã giải tán nhóm');
          navigate('/');
          onClose();
          break;
        case 'transfer':
          await dispatch(
            transferGroupOwnership({
              conversationId: conversation._id,
              newOwnerId: confirmAction.memberId,
            })
          ).unwrap();
          toast.success(`Đã chuyển quyền cho ${confirmAction.memberName}`);
          break;
        case 'transfer-and-leave':
          await dispatch(
            transferGroupOwnership({
              conversationId: conversation._id,
              newOwnerId: confirmAction.memberId,
            })
          ).unwrap();
          await dispatch(leaveGroup(conversation._id)).unwrap();
          toast.success('Đã chuyển quyền và rời nhóm');
          navigate('/');
          onClose();
          break;
      }
    } catch (err: any) {
      toast.error(err ?? 'Thao tác thất bại');
    }
    setConfirmAction(null);
  };

  const handleChangeRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      await dispatch(
        changeGroupRole({ conversationId: conversation._id, memberId, role: newRole })
      ).unwrap();
      toast.success(newRole === 'admin' ? 'Đã thăng chức Phó nhóm' : 'Đã hạ chức');
    } catch (err: any) {
      toast.error(err ?? 'Không thể thay đổi vai trò');
    }
  };

  const handleToggleSetting = async (key: string, value: boolean) => {
    try {
      await dispatch(
        updateGroupSettings({ conversationId: conversation._id, settings: { [key]: value } })
      ).unwrap();
      toast.success('Đã cập nhật cài đặt nhóm');
    } catch (err: any) {
      toast.error(err ?? 'Không thể cập nhật cài đặt');
    }
  };

  const handleBanMember = async (memberId: string, bannedUntil?: string) => {
    try {
      await dispatch(
        banGroupMember({ conversationId: conversation._id, memberId, bannedUntil })
      ).unwrap();
      toast.success('Đã cấm thành viên gửi tin nhắn');
    } catch (err: any) {
      toast.error(err ?? 'Không thể cấm thành viên');
    }
  };

  const handleUnbanMember = async (memberId: string) => {
    try {
      await dispatch(unbanGroupMember({ conversationId: conversation._id, memberId })).unwrap();
      toast.success('Đã bỏ cấm thành viên');
    } catch (err: any) {
      toast.error(err ?? 'Không thể bỏ cấm');
    }
  };

  return (
    <>
      <div className="w-[320px] h-full bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-[15px] font-bold text-gray-800">Thông tin nhóm</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Group info */}
          <div className="px-4 py-4 text-center border-b border-gray-100">
            <UserAvatar
              className="m-auto"
              src={conversation.avatar}
              name={conversation.name}
              size={64}
            />
            <h4 className="text-[15px] font-bold text-gray-800 mt-2">
              {conversation.name || 'Nhóm chat'}
            </h4>
            {conversation.description && (
              <p className="text-[12px] text-gray-500 mt-1">{conversation.description}</p>
            )}
            <p className="text-[12px] text-gray-400 mt-1">
              {conversation.participants.length} thành viên
            </p>
            {canManage && (
              <button
                onClick={() => setShowEditInfo(true)}
                className="mt-2 inline-flex items-center gap-1 text-[12px] text-[#0068FF] hover:underline"
              >
                <Edit3 className="w-3 h-3" /> Chỉnh sửa
              </button>
            )}
          </div>

          {/* Group Settings — owner only */}
          {isOwner && (
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="flex items-center justify-between w-full group"
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700">
                  <Settings className="w-4 h-4" /> Cài đặt nhóm
                </span>
                <span className="text-gray-400 text-[11px]">{showSettings ? '▲' : '▼'}</span>
              </button>
              {showSettings && (
                <div className="mt-3 space-y-2.5">
                  {(
                    [
                      ['onlyAdminCanSend', 'Chỉ Quản trị viên gửi tin nhắn'],
                      ['allowMemberInvite', 'Thành viên được mời người khác'],
                      ['onlyAdminCanPin', 'Chỉ quản trị viên được ghim tin nhắn'],
                    ] as [string, string][]
                  ).map(([key, label]) => {
                    const val = !!(conversation.settings as any)?.[key];
                    return (
                      <div key={key} className="flex items-center justify-between cursor-pointer">
                        <span className="text-[12px] text-gray-600">{label}</span>
                        <button
                          onClick={() => handleToggleSetting(key, !val)}
                          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${val ? 'bg-[#0068FF]' : 'bg-gray-200'}`}
                        >
                          <span
                            className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-6' : 'translate-x-1'}`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Members */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-[13px] font-semibold text-gray-700">
                Thành viên ({conversation.participants.length})
              </h5>
              {(canManage || !!(conversation.settings as any)?.allowMemberInvite) && (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 text-[#0068FF]"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              )}
            </div>

            <ul className="space-y-0.5">
              {sortedParticipants.map((p) => {
                const info = getMemberInfo(p.userId);
                const isSelf = p.userId === currentUser?.id;
                return (
                  <li
                    key={p.userId}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 group"
                  >
                    <UserAvatar src={info.avatar} name={info.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 truncate">{info.name}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {getRoleBadge(p.role)}
                        {p.isBanned && (
                          <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full font-medium">
                            Bị cấm
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions for owner */}
                    {isOwner && !isSelf && (
                      <div className="flex items-center gap-0.5">
                        {p.role === 'member' && (
                          <button
                            onClick={() => handleChangeRole(p.userId, 'admin')}
                            title="Thăng Phó nhóm"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-500"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {p.role === 'admin' && (
                          <button
                            onClick={() => handleChangeRole(p.userId, 'member')}
                            title="Hạ chức"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-orange-400 hover:bg-orange-50 hover:text-orange-500"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: 'transfer',
                              memberId: p.userId,
                              memberName: info.name,
                            })
                          }
                          title="Chuyển quyền chủ nhóm"
                          className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-amber-50 hover:text-amber-500"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: 'remove',
                              memberId: p.userId,
                              memberName: info.name,
                            })
                          }
                          title="Xóa khỏi nhóm"
                          className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                        {!p.isBanned ? (
                          <button
                            onClick={() => handleBanMember(p.userId)}
                            title="Cấm gửi tin nhắn 24h"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-orange-50 hover:text-orange-500"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnbanMember(p.userId)}
                            title="Bỏ cấm"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-orange-400 hover:bg-green-50 hover:text-green-500"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Admin can remove members (not owner or other admins) */}
                    {isAdmin && !isSelf && p.role === 'member' && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() =>
                            setConfirmAction({
                              type: 'remove',
                              memberId: p.userId,
                              memberName: info.name,
                            })
                          }
                          title="Xóa khỏi nhóm"
                          className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                        {!p.isBanned ? (
                          <button
                            onClick={() => handleBanMember(p.userId)}
                            title="Cấm gửi tin nhắn 24h"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-orange-50 hover:text-orange-500"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnbanMember(p.userId)}
                            title="Bỏ cấm"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-orange-400 hover:bg-green-50 hover:text-green-500"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Media / File / Link */}
          <MediaInfoPanel conversationId={conversation._id} />

          {/* Bảng tin nhóm */}
          <div className="border-t border-gray-100">
            <div className="px-4 py-3">
              <h4 className="text-[13px] font-semibold text-gray-700 mb-2">Bảng tin nhóm</h4>
              <button
                onClick={() => setShowReminderList(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <span className="text-[13px] text-gray-700">Danh sách nhắc hẹn</span>
              </button>
              <button
                onClick={() => setShowNoteList(true)}
                className="mt-1 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" />
                    <path d="M8 12h8M8 16h5" />
                  </svg>
                </div>
                <span className="text-[13px] text-gray-700">Ghi chú</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 py-3 border-t border-gray-100 space-y-1">
            {isOwner && (
              <button
                onClick={() => setShowTransferForLeave(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Rời nhóm
              </button>
            )}
            {!isOwner && (
              <button
                onClick={() => setConfirmAction({ type: 'leave' })}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Rời nhóm
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setConfirmAction({ type: 'dissolve' })}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Giải tán nhóm
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transfer ownership before leave dialog */}
      {showTransferForLeave && (
        <TransferAndLeaveModal
          conversation={conversation}
          getMemberInfo={getMemberInfo}
          onSelect={(memberId, memberName) => {
            setShowTransferForLeave(false);
            setConfirmAction({ type: 'transfer-and-leave', memberId, memberName });
          }}
          onClose={() => setShowTransferForLeave(false)}
        />
      )}

      {/* Confirm dialog */}
      <Dialog.Root open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-5 w-[320px] shadow-xl z-50 focus:outline-none">
            <Dialog.Title className="text-[15px] font-semibold text-gray-800 mb-1.5">
              {confirmAction?.type === 'remove' && 'Xóa thành viên'}
              {confirmAction?.type === 'leave' && 'Rời nhóm'}
              {confirmAction?.type === 'dissolve' && 'Giải tán nhóm'}
              {confirmAction?.type === 'transfer' && 'Chuyển quyền chủ nhóm'}
              {confirmAction?.type === 'transfer-and-leave' && 'Nhường quyền và rời nhóm'}
            </Dialog.Title>
            <Dialog.Description className="text-[13px] text-gray-500 mb-5 leading-relaxed">
              {confirmAction?.type === 'remove' &&
                `Bạn có chắc muốn xóa ${confirmAction.memberName} khỏi nhóm?`}
              {confirmAction?.type === 'leave' &&
                'Bạn sẽ không thể xem tin nhắn trong nhóm này nữa.'}
              {confirmAction?.type === 'dissolve' &&
                'Tất cả tin nhắn sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.'}
              {confirmAction?.type === 'transfer' &&
                `${confirmAction.memberName} sẽ trở thành chủ nhóm. Bạn sẽ trở thành Phó nhóm.`}
              {confirmAction?.type === 'transfer-and-leave' &&
                `${confirmAction.memberName} sẽ trở thành chủ nhóm. Sau đó bạn sẽ rời khỏi nhóm.`}
            </Dialog.Description>
            <div className="flex gap-2 justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 transition-colors">
                  Hủy
                </button>
              </Dialog.Close>
              <button
                onClick={handleConfirmExecute}
                className={`px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors ${
                  confirmAction?.type === 'dissolve'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#0068FF] hover:bg-[#0054CC]'
                }`}
              >
                Xác nhận
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Add member sub-modal */}
      {showAddMember && (
        <AddMemberModal
          conversationId={conversation._id}
          existingIds={conversation.participants.map((p) => p.userId)}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Edit info sub-modal */}
      {showEditInfo && (
        <EditGroupModal conversation={conversation} onClose={() => setShowEditInfo(false)} />
      )}

      {/* Reminder list modal */}
      {showReminderList && (
        <ReminderListModal
          conversationId={conversation._id}
          currentUserId={currentUser?.id ?? ''}
          onClose={() => setShowReminderList(false)}
        />
      )}

      {/* Note list modal */}
      {showNoteList && (
        <NoteListModal
          conversationId={conversation._id}
          currentUserId={currentUser?.id ?? ''}
          isAdmin={isOwner || isAdmin}
          onClose={() => setShowNoteList(false)}
        />
      )}
    </>
  );
}

// ── Sub-modal: Add Members ────────────────────────────────────────────────

function AddMemberModal({
  conversationId,
  existingIds,
  onClose,
}: {
  conversationId: string;
  existingIds: string[];
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const friends = useAppSelector((s) => s.friend.friends);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const available = useMemo(() => {
    return friends.filter((f) => !existingIds.includes(f.user.id));
  }, [friends, existingIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return available;
    const q = search.toLowerCase();
    return available.filter((f) => f.user.fullName?.toLowerCase().includes(q));
  }, [available, search]);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    setAdding(true);
    try {
      await dispatch(addGroupMembers({ conversationId, memberIds: selectedIds })).unwrap();
      toast.success(`Đã thêm ${selectedIds.length} thành viên`);
      onClose();
    } catch (err: any) {
      toast.error(err ?? 'Không thể thêm thành viên');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-xl w-[380px] max-h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-[15px] font-bold text-gray-800">Thêm thành viên</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm bạn bè..."
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-[#0068FF]/40 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400 mt-6">Không tìm thấy</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((f) => {
                const isSelected = selectedIds.includes(f.user.id);
                return (
                  <li
                    key={f.user.id}
                    onClick={() => toggleSelect(f.user.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#EBF3FF]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <UserAvatar src={f.user.avatar} name={f.user.fullName} size={32} />
                    <p className="flex-1 text-[13px] font-medium text-gray-800 truncate">
                      {f.user.fullName}
                    </p>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'bg-[#0068FF] border-[#0068FF]' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleAdd}
            disabled={adding || selectedIds.length === 0}
            className="px-4 py-2 rounded-xl bg-[#0068FF] text-white text-[13px] font-medium hover:bg-[#0054CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? 'Đang thêm...' : `Thêm (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sub-modal: Edit Group Info ────────────────────────────────────────────

function EditGroupModal({
  conversation,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState(conversation.name || '');
  const [description, setDescription] = useState(conversation.description || '');
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận file ảnh');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 5MB');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async (): Promise<string | undefined> => {
    if (!avatarFile) return undefined;
    setUploadingAvatar(true);
    try {
      const { authServices } = await import('@/services/authServices');
      const { presignedUrl, objectKey } = await authServices.presignUpload({
        category: 'avatar',
        filename: avatarFile.name,
        mimeType: avatarFile.type,
        fileSize: avatarFile.size,
      });
      await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': avatarFile.type },
        body: avatarFile,
      });
      const { cdnUrl } = await authServices.finalizeUpload({
        objectKey,
        category: 'avatar',
      });
      return cdnUrl;
    } catch {
      toast.error('Không thể tải ảnh lên');
      return undefined;
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Tên nhóm không được để trống');
      return;
    }
    setSaving(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        avatarUrl = await uploadAvatar();
        if (avatarFile && !avatarUrl) {
          setSaving(false);
          return;
        }
      }
      await dispatch(
        updateGroup({
          conversationId: conversation._id,
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            avatar: avatarUrl,
          },
        })
      ).unwrap();
      toast.success('Đã cập nhật thông tin nhóm');
      onClose();
    } catch (err: any) {
      toast.error(err ?? 'Không thể cập nhật');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-xl w-[380px] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-[15px] font-bold text-gray-800">Chỉnh sửa nhóm</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Avatar upload */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <UserAvatar
                src={avatarPreview || conversation.avatar}
                name={conversation.name}
                size={72}
              />
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-600 mb-1">Tên nhóm</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 text-[13px] bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-[#0068FF]/40 focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-gray-600 mb-1">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 text-[13px] bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-[#0068FF]/40 focus:bg-white transition-colors resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploadingAvatar || !name.trim()}
            className="px-4 py-2 rounded-xl bg-[#0068FF] text-white text-[13px] font-medium hover:bg-[#0054CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving || uploadingAvatar ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sub-modal: Transfer Ownership and Leave ───────────────────────────────

function TransferAndLeaveModal({
  conversation,
  getMemberInfo,
  onSelect,
  onClose,
}: {
  conversation: Conversation;
  getMemberInfo: (userId: string) => { name: string; avatar?: string | null };
  onSelect: (memberId: string, memberName: string) => void;
  onClose: () => void;
}) {
  const currentUser = useAppSelector((s) => s.auth.user);
  const [search, setSearch] = useState('');

  const otherMembers = useMemo(() => {
    return conversation.participants
      .filter((p) => p.userId !== currentUser?.id)
      .map((p) => ({ ...p, ...getMemberInfo(p.userId) }));
  }, [conversation.participants, currentUser?.id, getMemberInfo]);

  const filtered = useMemo(() => {
    if (!search.trim()) return otherMembers;
    const q = search.toLowerCase();
    return otherMembers.filter((m) => m.name.toLowerCase().includes(q));
  }, [otherMembers, search]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-xl w-[380px] max-h-[60vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-[15px] font-bold text-gray-800">Chọn chủ nhóm mới</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <p className="px-5 pt-3 pb-1 text-[12px] text-gray-500">
          Bạn cần nhường quyền chủ nhóm trước khi rời nhóm.
        </p>

        <div className="px-5 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm thành viên..."
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-[#0068FF]/40 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400 mt-4">Không tìm thấy</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((m) => (
                <li
                  key={m.userId}
                  onClick={() => onSelect(m.userId, m.name)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[#EBF3FF] transition-colors"
                >
                  <UserAvatar src={m.avatar} name={m.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{m.name}</p>
                    {m.role === 'admin' && (
                      <span className="text-[10px] text-blue-500">Phó nhóm</span>
                    )}
                  </div>
                  <Crown className="w-4 h-4 text-gray-300" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
