import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { setActiveConversation, fetchConversations } from '@/store/slices';
import { ChatWelcome } from '@/components/ChatWelcome';
import ConversationList from './components/ConversationList';
import ChatRoom from './components/ChatRoom';
import { chatServices } from '@/services/chatServices';

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const activeConversationId = useAppSelector((s) => s.chat.activeConversationId);

  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  useEffect(() => {
    dispatch(setActiveConversation(conversationId ?? null));
    if (conversationId) {
      chatServices.markAsRead(conversationId).catch(() => {});
    }
  }, [conversationId, dispatch]);

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
  };

  return (
    <div className="flex w-full h-full min-h-0 overflow-hidden">
      <ConversationList
        activeId={conversationId ?? null}
        onSelect={handleSelectConversation}
        className={conversationId ? 'hidden md:flex' : 'flex'}
      />
      <div className={`${conversationId ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 min-h-0 flex-col`}>
        {conversationId ? (
          <ChatRoom conversationId={conversationId} onBack={() => navigate('/')} />
        ) : (
          <ChatWelcome />
        )}
      </div>
    </div>
  );
}
