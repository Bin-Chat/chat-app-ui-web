import { useState, useMemo } from 'react';
import { X, Search, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { createConversation } from '@/store/slices';
import UserAvatar from '@/components/UserAvatar';

interface CreateGroupModalProps {
  onClose: () => void;
}

export default function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const friends = useAppSelector((s) => s.friend.friends);

  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return friends;
    const q = search.toLowerCase();
    return friends.filter((f) => f.user.fullName?.toLowerCase().includes(q));
  }, [friends, search]);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm');
      return;
    }
    if (selectedIds.length < 2) {
      toast.error('Nhóm cần ít nhất 2 thành viên khác');
      return;
    }
    setCreating(true);
    try {
      const conv = await dispatch(
        createConversation({
          type: 'group',
          participantIds: selectedIds,
          name: groupName.trim(),
        })
      ).unwrap();
      toast.success('Tạo nhóm thành công!');
      onClose();
      navigate(`/chat/${conv._id}`);
    } catch (err: any) {
      toast.error(err ?? 'Không thể tạo nhóm');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl w-[420px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[16px] font-bold text-gray-800">Tạo nhóm mới</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Group name */}
        <div className="px-5 pt-4 pb-2">
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Tên nhóm..."
            maxLength={100}
            className="w-full px-3 py-2.5 text-[14px] bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-[#0068FF]/40 focus:bg-white transition-colors"
          />
        </div>

        {/* Search friends */}
        <div className="px-5 pb-2">
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

        {/* Selected tags */}
        {selectedIds.length > 0 && (
          <div className="px-5 pb-2 flex flex-wrap gap-1.5">
            {selectedIds.map((uid) => {
              const friend = friends.find((f) => f.user.id === uid);
              return (
                <span
                  key={uid}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#EBF3FF] text-[#0068FF] text-[12px] font-medium rounded-lg"
                >
                  {friend?.user.fullName || 'Người dùng'}
                  <button
                    onClick={() => toggleSelect(uid)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Friend list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-gray-400 mt-6">
              {search ? 'Không tìm thấy' : 'Chưa có bạn bè'}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((f) => {
                const isSelected = selectedIds.includes(f.user.id);
                return (
                  <li
                    key={f.user.id}
                    onClick={() => toggleSelect(f.user.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#EBF3FF]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <UserAvatar src={f.user.avatar} name={f.user.fullName} size={36} />
                    <p className="flex-1 text-[13px] font-medium text-gray-800 truncate">
                      {f.user.fullName}
                    </p>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#0068FF] border-[#0068FF]'
                          : 'border-gray-300'
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

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[12px] text-gray-400">
            Đã chọn {selectedIds.length} thành viên
          </span>
          <button
            onClick={handleCreate}
            disabled={creating || !groupName.trim() || selectedIds.length < 2}
            className="px-5 py-2 rounded-xl bg-[#0068FF] text-white text-[13px] font-medium hover:bg-[#0054CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Đang tạo...' : 'Tạo nhóm'}
          </button>
        </div>
      </div>
    </>
  );
}
