import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Search, Users, UserCheck, Send, Loader2 } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { fetchFriends, fetchReceivedRequests, fetchSentRequests } from '@/store/slices';
import type { FriendItem, FriendRequest } from '@/types/friend.type';

import FriendCard from './components/FriendCard';
import ReceivedRequestCard from './components/ReceivedRequestCard';
import SentRequestCard from './components/SentRequestCard';
import AddFriendPanel from './components/AddFriendPanel';
import FriendProfilePanel from './components/FriendProfilePanel';
import SenderProfilePanel from './components/SenderProfilePanel';

type Tab = 'friends' | 'received' | 'sent';

export default function ContactsPage() {
  const dispatch = useAppDispatch();
  const { friends, receivedRequests, sentRequests, loadingFriends, loadingRequests } =
    useAppSelector((s) => s.friend);

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<FriendRequest | null>(null);

  // Load all data on mount
  useEffect(() => {
    dispatch(fetchFriends());
    dispatch(fetchReceivedRequests());
    dispatch(fetchSentRequests());
  }, [dispatch]);

  // Filter friends by search query
  const filteredFriends = friends.filter(
    (f) =>
      (f.user?.fullName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.user?.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectFriend = useCallback((item: FriendItem) => {
    setSelectedFriend(item);
    setSelectedRequest(null);
    setShowAddPanel(false);
  }, []);

  const handleSelectRequest = useCallback((item: FriendRequest) => {
    setSelectedRequest(item);
    setSelectedFriend(null);
    setShowAddPanel(false);
  }, []);

  const handleShowAddPanel = () => {
    setShowAddPanel(true);
    setSelectedFriend(null);
    setSelectedRequest(null);
  };

  const tabs: { id: Tab; label: string; icon: typeof Users; count?: number }[] = [
    { id: 'friends', label: 'Bạn bè', icon: UserCheck, count: friends.length },
    { id: 'received', label: 'Lời mời', icon: Users, count: receivedRequests.length },
    { id: 'sent', label: 'Đã gửi', icon: Send, count: sentRequests.length },
  ];

  const isLoading = activeTab === 'friends' ? loadingFriends : loadingRequests;

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
      {/* ── Left panel (sub-sidebar) ──────────────────────────────────── */}
      <div className="w-full md:w-[280px] max-h-[46vh] md:max-h-none flex flex-col bg-white border-b md:border-b-0 md:border-r border-gray-100 flex-shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 className="text-[16px] font-bold text-gray-800">Danh bạ</h2>
          <button
            onClick={handleShowAddPanel}
            title="Thêm bạn"
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-gray-500 hover:bg-[#EBF3FF] hover:text-[#0068FF] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Search (friends tab only) */}
        {activeTab === 'friends' && (
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm trong danh sách..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200
                           rounded-lg focus:outline-none focus:border-[#0068FF] focus:bg-white
                           transition-colors placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[12px] font-medium
                            border-b-2 transition-all duration-150
                            ${
                              isActive
                                ? 'text-[#0068FF] border-[#0068FF]'
                                : 'text-gray-500 border-transparent hover:text-gray-700'
                            }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none
                      ${isActive ? 'bg-[#0068FF] text-white' : 'bg-gray-200 text-gray-500'}`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto py-1.5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#0068FF] animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.ul
                key={activeTab}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="px-1.5 space-y-0.5"
              >
                {activeTab === 'friends' && (
                  <>
                    {filteredFriends.length === 0 ? (
                      <li className="flex flex-col items-center justify-center py-10 text-gray-400 select-none">
                        <UserCheck className="w-8 h-8 mb-2 opacity-30" strokeWidth={1.2} />
                        <p className="text-[12px]">
                          {searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có bạn bè nào'}
                        </p>
                      </li>
                    ) : (
                      filteredFriends.map((item) => (
                        <FriendCard
                          key={item.friendshipId}
                          item={item}
                          isSelected={selectedFriend?.friendshipId === item.friendshipId}
                          onClick={() => handleSelectFriend(item)}
                        />
                      ))
                    )}
                  </>
                )}

                {activeTab === 'received' && (
                  <>
                    {receivedRequests.length === 0 ? (
                      <li className="flex flex-col items-center justify-center py-10 text-gray-400 select-none">
                        <Users className="w-8 h-8 mb-2 opacity-30" strokeWidth={1.2} />
                        <p className="text-[12px]">Không có lời mời nào</p>
                      </li>
                    ) : (
                      receivedRequests.map((item) => (
                        <ReceivedRequestCard
                          key={item.friendshipId}
                          item={item}
                          isSelected={selectedRequest?.friendshipId === item.friendshipId}
                          onSelect={() => handleSelectRequest(item)}
                        />
                      ))
                    )}
                  </>
                )}

                {activeTab === 'sent' && (
                  <>
                    {sentRequests.length === 0 ? (
                      <li className="flex flex-col items-center justify-center py-10 text-gray-400 select-none">
                        <Send className="w-8 h-8 mb-2 opacity-30" strokeWidth={1.2} />
                        <p className="text-[12px]">Chưa gửi lời mời nào</p>
                      </li>
                    ) : (
                      sentRequests.map((item) => (
                        <SentRequestCard key={item.friendshipId} item={item} />
                      ))
                    )}
                  </>
                )}
              </motion.ul>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 min-h-0 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {showAddPanel ? (
            <motion.div
              key="add-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col bg-white"
            >
              <AddFriendPanel onClose={() => setShowAddPanel(false)} />
            </motion.div>
          ) : activeTab === 'received' ? (
            <motion.div
              key={selectedRequest?.friendshipId ?? 'empty-request'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex"
            >
              <SenderProfilePanel item={selectedRequest} />
            </motion.div>
          ) : (
            <motion.div
              key={selectedFriend?.friendshipId ?? 'empty'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex"
            >
              <FriendProfilePanel item={selectedFriend} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
