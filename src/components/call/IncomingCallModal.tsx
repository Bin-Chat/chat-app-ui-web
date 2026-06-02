import { useEffect } from 'react';
import { Phone, PhoneOff, PhoneCall, Video } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { clearIncomingCall, acceptCall, endCall } from '@/store/slices';
import { appSocket } from '@/services/appSocket';
import UserAvatar from '@/components/UserAvatar';
import { callRingtone } from '@/services/callRingtone';

/**
 * Shown as a floating banner when there is an incoming call.
 * Renders on top of everything via fixed positioning.
 */
export default function IncomingCallModal() {
  const dispatch = useAppDispatch();
  const incoming = useAppSelector((s) => s.call.incomingCall);
  const currentUser = useAppSelector((s) => s.auth.user);
  const incomingCallId = incoming?.callId;

  // Play ringtone while modal is visible
  useEffect(() => {
    if (!incomingCallId) {
      callRingtone.stop();
      return;
    }
    callRingtone.start();

    return () => {
      callRingtone.stop();
    };
  }, [incomingCallId]);

  if (!incoming) return null;

  const handleAccept = () => {
    callRingtone.stop();
    dispatch(
      acceptCall({
        callId: incoming.callId,
        conversationId: incoming.conversationId,
        callType: incoming.callType,
        callerId: incoming.callerId,
        currentUserId: currentUser?.id,
      })
    );
  };

  const handleDecline = () => {
    callRingtone.stop();
    appSocket.emit('call:reject', { callId: incoming.callId });
    dispatch(clearIncomingCall());
    dispatch(endCall());
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pointer-events-none">
      {/* Backdrop blur — only the card intercepts clicks */}
      <div
        className="pointer-events-auto mt-6 w-80 rounded-2xl bg-gray-900 shadow-2xl overflow-hidden
                    animate-in slide-in-from-top-4 duration-300"
      >
        {/* Header gradient */}
        <div className="px-5 pt-5 pb-4">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">
            {incoming.callType === 'video' ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'}
          </p>

          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <UserAvatar src={incoming.callerAvatar} name={incoming.callerName} size={52} />
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-full ring-4 ring-green-400/40 animate-ping" />
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-white truncate">{incoming.callerName}</p>
              <div className="flex items-center gap-1 text-gray-400 text-[12px] mt-0.5">
                {incoming.callType === 'video' ? (
                  <Video className="w-3 h-3" />
                ) : (
                  <PhoneCall className="w-3 h-3" />
                )}
                <span>Đang gọi cho bạn…</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex border-t border-gray-700">
          <button
            onClick={handleDecline}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-red-400
                       hover:bg-red-500/10 transition-colors text-[13px] font-medium"
          >
            <PhoneOff className="w-4 h-4" />
            Từ chối
          </button>
          <div className="w-px bg-gray-700" />
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-green-400
                       hover:bg-green-500/10 transition-colors text-[13px] font-medium"
          >
            <Phone className="w-4 h-4" />
            Chấp nhận
          </button>
        </div>
      </div>
    </div>
  );
}
