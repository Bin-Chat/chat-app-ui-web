import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { setActiveConversation, fetchConversations } from '@/store/slices';
import { ChatWelcome } from '@/components/ChatWelcome';
import ConversationList from './components/ConversationList';
import ChatRoom from './components/ChatRoom';

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
  }, [conversationId, dispatch]);

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
  };

  return (
    <div className="flex w-full h-full overflow-hidden">
      <ConversationList activeId={conversationId ?? null} onSelect={handleSelectConversation} />
      <div className="flex-1 min-w-0 flex flex-col">
        {conversationId ? <ChatRoom conversationId={conversationId} /> : <ChatWelcome />}
      </div>
    </div>
  );
}
